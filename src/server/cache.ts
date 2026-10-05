import "server-only";

import { createHash } from "node:crypto";

import { type Prisma } from "../../generated/prisma";
import { db } from "~/server/db";

/*
 * Two-level cache for external API responses: a small in-process LRU in front of the ApiCache
 * table. The table is what saves YouTube quota across restarts and between the dev and prod
 * containers' instances; the LRU keeps hot keys (the home page shelves) off the database.
 * Concurrent requests for the same key share one upstream call.
 */

const MAX_MEMORY_ENTRIES = 500;
const memory = new Map<string, { value: unknown; expiresAt: number }>();
const inflight = new Map<string, Promise<unknown>>();

function remember(key: string, value: unknown, expiresAt: number) {
  memory.delete(key);
  memory.set(key, { value, expiresAt });
  if (memory.size > MAX_MEMORY_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
}

/** Keys longer than the indexed column get hashed, keeping a readable prefix for debugging. */
function storageKey(key: string): string {
  if (key.length <= 150) return key;
  const digest = createHash("sha1").update(key).digest("hex");
  return `${key.slice(0, 100)}#${digest}`;
}

/**
 * Returns the cached value for `key`, or runs `load` and caches what it returns for `ttlSeconds`.
 * `null` results are returned but not cached.
 */
export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const id = storageKey(key);
  const now = Date.now();

  const hit = memory.get(id);
  if (hit && hit.expiresAt > now) {
    remember(id, hit.value, hit.expiresAt);
    return hit.value as T;
  }

  const pending = inflight.get(id);
  if (pending) return pending as Promise<T>;

  const promise = (async () => {
    try {
      const row = await db.apiCache.findUnique({ where: { key: id } }).catch(() => null);
      if (row && row.expiresAt.getTime() > now) {
        remember(id, row.value, row.expiresAt.getTime());
        return row.value as T;
      }

      const value = await load();
      // A miss (deleted video, upstream hiccup) is retried next time instead of pinned for the TTL.
      if (value === null || value === undefined) return value;

      const expiresAt = now + ttlSeconds * 1000;
      remember(id, value, expiresAt);
      await db.apiCache
        .upsert({
          where: { key: id },
          create: { key: id, value: value as Prisma.InputJsonValue, expiresAt: new Date(expiresAt) },
          update: { value: value as Prisma.InputJsonValue, expiresAt: new Date(expiresAt) },
        })
        .catch(() => undefined);

      // Sweep expired rows now and then instead of running a cron.
      if (Math.random() < 0.02) {
        void db.apiCache.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => undefined);
      }
      return value;
    } finally {
      inflight.delete(id);
    }
  })();

  inflight.set(id, promise);
  return promise;
}

/** Normalizes a free-text query so "Daft  Punk" and "daft punk" share a cache entry. */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}
