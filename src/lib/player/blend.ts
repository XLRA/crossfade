import { type TrackData } from "~/lib/types";

/**
 * Volumes for the two tracks at point `t` (0 to 1) of a blend, on an equal-power curve: the
 * squares always add up to one, so the mix stays as loud in the middle as at either end, where
 * a straight linear fade dips by about 3 dB.
 */
export function equalPower(t: number): { outgoing: number; incoming: number } {
  const clamped = Math.min(1, Math.max(0, t));
  return { outgoing: Math.cos((clamped * Math.PI) / 2), incoming: Math.sin((clamped * Math.PI) / 2) };
}

const normalize = (text: string) => text.trim().toLowerCase();

/**
 * Whether `next` carries straight on from `current` on the same album. Those play through
 * without a crossfade: live albums, DJ mixes and concept albums are sequenced to flow into each
 * other, and blending would smear the transitions their artists made.
 */
export function continuesAlbum(current: TrackData, next: TrackData): boolean {
  if (current.source !== next.source || !current.album || !next.album) return false;
  return normalize(current.album) === normalize(next.album) && normalize(current.artist) === normalize(next.artist);
}
