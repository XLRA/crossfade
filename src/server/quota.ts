import "server-only";

import { db } from "~/server/db";

/*
 * YouTube Data API budget: 10,000 units per day, resetting at midnight Pacific. A search costs
 * 100 units and nearly everything else costs 1, so searches are cut off first and the last
 * stretch of the budget is kept for imports and single-video lookups.
 */

export const YOUTUBE_DAILY_UNITS = 10_000;
const SEARCH_CEILING = 8_500;
const LOOKUP_CEILING = 9_900;

const usage = new Map<string, { units: number; readAt: number }>();

export function quotaDay(now = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function quotaUsed(provider: string): Promise<number> {
  const day = quotaDay();
  const key = `${provider}:${day}`;
  const memo = usage.get(key);
  if (memo && Date.now() - memo.readAt < 5_000) return memo.units;
  const row = await db.apiQuota.findUnique({ where: { provider_day: { provider, day } } });
  const units = row?.units ?? 0;
  usage.set(key, { units, readAt: Date.now() });
  return units;
}

/** Whether a call of this cost fits in what's left of today's YouTube budget. */
export async function canSpendYouTube(cost: number): Promise<boolean> {
  const used = await quotaUsed("youtube");
  const ceiling = cost >= 100 ? SEARCH_CEILING : LOOKUP_CEILING;
  return used + cost <= ceiling;
}

export async function spendQuota(provider: string, units: number): Promise<void> {
  const day = quotaDay();
  const row = await db.apiQuota.upsert({
    where: { provider_day: { provider, day } },
    create: { provider, day, units },
    update: { units: { increment: units } },
  });
  usage.set(`${provider}:${day}`, { units: row.units, readAt: Date.now() });
}

/** Google told us we're out; trust it over our own count until the day rolls over. */
export async function markQuotaExhausted(provider: string): Promise<void> {
  const day = quotaDay();
  await db.apiQuota.upsert({
    where: { provider_day: { provider, day } },
    create: { provider, day, units: YOUTUBE_DAILY_UNITS },
    update: { units: YOUTUBE_DAILY_UNITS },
  });
  usage.set(`${provider}:${day}`, { units: YOUTUBE_DAILY_UNITS, readAt: Date.now() });
}
