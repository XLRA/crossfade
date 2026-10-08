"use client";

import { cn } from "~/lib/cn";
import { usePlayer } from "~/lib/player/store";
import { type TrackData, trackKey } from "~/lib/types";

export type TrackStatus = "playing" | "paused" | null;

/** Whether this track is the one loaded in the player, and if so whether it's sounding. */
export function useTrackStatus(track: Pick<TrackData, "source" | "sourceId">): TrackStatus {
  const key = trackKey(track);
  return usePlayer((s) => {
    if (!s.current || trackKey(s.current.track) !== key) return null;
    return s.status === "playing" || s.status === "loading" ? "playing" : "paused";
  });
}

/** Three bouncing bars, frozen while paused. */
export function Equalizer({ paused = false, className }: { paused?: boolean; className?: string }) {
  return (
    <span className={cn("eq", className)} data-paused={paused} aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}
