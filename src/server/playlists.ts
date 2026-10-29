import "server-only";

import { TRPCError } from "@trpc/server";

import { type Prisma } from "../../generated/prisma";
import { db } from "~/server/db";

/** Most tracks one playlist can hold. Imports are cut off here too. */
export const MAX_PLAYLIST_TRACKS = 2_000;

/** What someone can do with a playlist. Higher roles include everything below them. */
export type PlaylistRole = "owner" | "editor" | "viewer";

const RANK: Record<PlaylistRole, number> = { viewer: 1, editor: 2, owner: 3 };

export async function roleFor(playlistId: string, userId: string | null | undefined): Promise<PlaylistRole | null> {
  const playlist = await db.playlist.findUnique({ where: { id: playlistId }, select: { ownerId: true } });
  if (!playlist) return null;
  if (userId && playlist.ownerId === userId) return "owner";
  return null;
}

/**
 * Throws unless the user has at least `needed` on the playlist. Playlists you can't see at all
 * are reported as missing rather than forbidden, so ids can't be probed.
 */
export async function requireRole(
  playlistId: string,
  userId: string | null | undefined,
  needed: PlaylistRole,
): Promise<PlaylistRole> {
  const role = await roleFor(playlistId, userId);
  if (!role)
    throw new TRPCError({ code: "NOT_FOUND", message: "That playlist doesn't exist or isn't shared with you." });
  if (RANK[role] < RANK[needed]) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: needed === "owner" ? "Only the playlist's owner can do that." : "You can't edit this playlist.",
    });
  }
  return role;
}

/** Serializes edits to one playlist so concurrent reorders can't interleave their position shifts. */
export async function lockPlaylist(tx: Prisma.TransactionClient, playlistId: string) {
  await tx.$queryRaw`SELECT id FROM Playlist WHERE id = ${playlistId} FOR UPDATE`;
}

/** Rewrites positions as 0..n-1 in their current order, in one statement. */
export async function renumber(tx: Prisma.TransactionClient, playlistId: string) {
  await tx.$executeRaw`
    UPDATE PlaylistTrack pt
    JOIN (
      SELECT id, ROW_NUMBER() OVER (ORDER BY position, addedAt, id) - 1 AS rn
      FROM PlaylistTrack
      WHERE playlistId = ${playlistId}
    ) ranked ON ranked.id = pt.id
    SET pt.position = ranked.rn
    WHERE pt.playlistId = ${playlistId}`;
}

export async function touch(tx: Prisma.TransactionClient, playlistId: string) {
  await tx.playlist.update({ where: { id: playlistId }, data: { updatedAt: new Date() } });
}
