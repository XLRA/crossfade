import "server-only";

import { type SourceName, type TrackData } from "~/lib/types";
import { storeTracks } from "~/server/catalog";
import { db } from "~/server/db";
import { MAX_PLAYLIST_TRACKS } from "~/server/playlists";

const clip = (text: string | null | undefined, max: number) => (text ? text.trim().slice(0, max) || null : null);

/**
 * Saves an imported (or linked) playlist or album as a new Crossfade playlist owned by `ownerId`.
 * It's a copy: later changes on the platform don't follow it.
 */
export async function saveAsPlaylist({
  ownerId,
  title,
  description,
  tracks,
  source,
  sourceId,
}: {
  ownerId: string;
  title: string;
  description?: string | null;
  tracks: TrackData[];
  source: SourceName;
  sourceId: string;
}): Promise<{ id: string; title: string; added: number }> {
  const rows = await storeTracks(tracks.slice(0, MAX_PLAYLIST_TRACKS));

  return db.$transaction(async (tx) => {
    const playlist = await tx.playlist.create({
      data: {
        ownerId,
        title: clip(title, 100) ?? "Imported playlist",
        description: clip(description, 300),
        importSource: source,
        importSourceId: sourceId,
        importedAt: new Date(),
      },
      select: { id: true, title: true },
    });
    if (rows.length > 0) {
      await tx.playlistTrack.createMany({
        data: rows.map((row, position) => ({
          playlistId: playlist.id,
          trackId: row.id,
          position,
          addedById: ownerId,
        })),
      });
    }
    return { ...playlist, added: rows.length };
  });
}

/** Which of these platform playlists the user has imported already, newest copy first. */
export async function importedCopies(ownerId: string, source: SourceName, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db.playlist.findMany({
    where: { ownerId, importSource: source, importSourceId: { in: ids } },
    orderBy: { importedAt: "asc" },
    select: { id: true, importSourceId: true },
  });
  // Ascending order, so later copies overwrite earlier ones in the map.
  return new Map(rows.map((row) => [row.importSourceId!, row.id]));
}
