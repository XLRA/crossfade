/**
 * How long a track has to play before it counts as a listen in history: 30 seconds, or half of a
 * shorter track (but at least 5 seconds). Tracks whose length isn't known yet use the 30 seconds.
 */
export function listenThresholdMs(durationMs: number): number {
  if (durationMs <= 0) return 30_000;
  return Math.min(30_000, Math.max(5_000, durationMs / 2));
}
