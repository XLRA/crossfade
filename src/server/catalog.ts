import "server-only";

import { type Track } from "../../generated/prisma";
import { type TrackData, type TrackRef, trackKey } from "~/lib/types";
import { AdapterError, spotify, youtube } from "~/server/adapters";
import { db } from "~/server/db";

/*
 * The Track table is a shared catalog: one row per platform track, referenced by every playlist
 * that contains it. Clients only ever send references (platform + id). Metadata always comes from
 * the platform, never from the client, so nobody can rename a track in someone else's playlist.
 */

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

export function isValidRef(ref: TrackRef): boolean {
  return ref.source === "YOUTUBE" ? YOUTUBE_ID.test(ref.sourceId) : SPOTIFY_ID.test(ref.sourceId);
}

export type CatalogTrack = TrackData & { id: string };

export function fromRow(row: Track): CatalogTrack {
  return {
    id: row.id,
    source: row.source,
    sourceId: row.sourceId,
    title: row.title,
    artist: row.artist,
    album: row.album,
    albumId: row.albumId,
    artworkUrl: row.artworkUrl,
    durationMs: row.durationMs,
    explicit: row.explicit,
    isrc: row.isrc,
  };
}

const clip = (value: string | null, max: number) => (value && value.length > max ? value.slice(0, max) : value);

function toRow(track: TrackData) {
  return {
    source: track.source,
    sourceId: track.sourceId,
    title: clip(track.title, 512) ?? "Untitled",
    artist: clip(track.artist, 512) ?? "Unknown artist",
    album: clip(track.album, 512),
    albumId: clip(track.albumId, 64),
    artworkUrl: track.artworkUrl && track.artworkUrl.length <= 1024 ? track.artworkUrl : null,
    durationMs: Math.max(0, Math.round(track.durationMs)),
    explicit: track.explicit,
    isrc: clip(track.isrc, 32),
  };
}

/** YouTube metadata for ids the catalog hasn't seen: the Data API if it's set up, oEmbed otherwise. */
async function lookupYouTube(ids: string[]): Promise<TrackData[]> {
  if (youtube.configured) {
    try {
      return await youtube.getTracks(ids);
    } catch (error) {
      // Out of quota or YouTube is down: oEmbed still works, it just doesn't know durations.
      if (!(error instanceof AdapterError)) throw error;
    }
  }
  const out: TrackData[] = [];
  for (let i = 0; i < ids.length; i += 4) {
    const batch = await Promise.all(ids.slice(i, i + 4).map((id) => youtube.oembed(id).catch(() => null)));
    for (const track of batch) if (track) out.push(track);
  }
  return out;
}

/** Spotify metadata, one request per id. Nothing to fall back to if Spotify isn't set up. */
async function lookupSpotify(ids: string[]): Promise<TrackData[]> {
  if (!spotify.configured) return [];
  return spotify.getTracks(ids);
}

/** Platform lookups by source. */
const lookups: Partial<Record<TrackRef["source"], (ids: string[]) => Promise<TrackData[]>>> = {
  YOUTUBE: lookupYouTube,
  SPOTIFY: lookupSpotify,
};

export function registerLookup(source: TrackRef["source"], lookup: (ids: string[]) => Promise<TrackData[]>) {
  lookups[source] = lookup;
}

function whereRefs(refs: TrackRef[]) {
  const bySource = new Map<TrackRef["source"], string[]>();
  for (const ref of refs) bySource.set(ref.source, [...(bySource.get(ref.source) ?? []), ref.sourceId]);
  return {
    OR: [...bySource].map(([source, ids]) => ({
      source,
      sourceId: { in: ids },
    })),
  };
}

/**
 * Catalog rows for the given references, looking up and storing any that are new. References
 * that are malformed or that the platform doesn't know are left out of the result.
 */
export async function ensureTracks(refs: TrackRef[]): Promise<Map<string, Track>> {
  const unique = [...new Map(refs.filter(isValidRef).map((ref) => [trackKey(ref), ref])).values()];
  const found = new Map<string, Track>();
  if (unique.length === 0) return found;

  for (const row of await db.track.findMany({ where: whereRefs(unique) })) found.set(trackKey(row), row);

  const missing = unique.filter((ref) => !found.has(trackKey(ref)));
  if (missing.length === 0) return found;

  const fetched: TrackData[] = [];
  for (const source of ["YOUTUBE", "SPOTIFY"] as const) {
    const ids = missing.filter((ref) => ref.source === source).map((ref) => ref.sourceId);
    const lookup = lookups[source];
    if (ids.length && lookup) fetched.push(...(await lookup(ids)));
  }
  if (fetched.length === 0) return found;

  await db.track.createMany({ data: fetched.map(toRow), skipDuplicates: true });
  for (const row of await db.track.findMany({ where: whereRefs(fetched) })) found.set(trackKey(row), row);
  return found;
}
