import "server-only";

import { withBase } from "~/lib/base-path";
import { coverImages } from "~/lib/types";

/**
 * Largest cover the server keeps. Browsers send a 640px JPEG, usually 60 to 150 KB; the limit
 * leaves room for busy images without letting anyone store something big.
 */
export const MAX_COVER_BYTES = 512 * 1024;

/** Where a playlist's uploaded cover is served. The version changes with every upload. */
export function coverUrl(playlistId: string, updatedAt: Date): string {
  return withBase(`/api/covers/${playlistId}?v=${updatedAt.getTime().toString(36)}`);
}

/**
 * The images a playlist cover is drawn from: the uploaded one on its own, or else the artwork of
 * its first tracks (which the client lays out as a mosaic).
 */
export function playlistCovers(
  playlist: { id: string; coverUpdatedAt: Date | null },
  artwork: (string | null)[],
): string[] {
  return playlist.coverUpdatedAt ? [coverUrl(playlist.id, playlist.coverUpdatedAt)] : coverImages(artwork);
}

/**
 * Whether the bytes are a complete JPEG: the start-of-image marker, a JFIF or Exif segment or a
 * frame right after it, and the end-of-image marker last.
 */
export function isJpeg(bytes: Uint8Array): boolean {
  if (bytes.length < 128) return false;
  const start = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const end = bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  return start && end;
}
