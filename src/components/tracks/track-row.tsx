"use client";

import { Play } from "lucide-react";

import { Artwork } from "~/components/tracks/artwork";
import { ExplicitBadge, SourceIcon, SOURCE_LABEL } from "~/components/tracks/source-badge";
import { cn } from "~/lib/cn";
import { formatDuration } from "~/lib/format";
import { type TrackData } from "~/lib/types";

/**
 * Compact row used in search results and shelves: art, title, platform + artist, duration.
 * Playlist pages use the full table instead.
 */
export function TrackRow({
  track,
  onPlay,
  active = false,
  actions,
  className,
}: {
  track: TrackData;
  onPlay?: () => void;
  active?: boolean;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      onDoubleClick={onPlay}
      className={cn(
        "group grid h-14 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 transition-colors hover:bg-white/[0.06] focus-within:bg-white/[0.06]",
        className,
      )}
    >
      <div className="relative size-10">
        <Artwork src={track.artworkUrl} className="size-10 rounded" />
        {onPlay && (
          <button
            type="button"
            onClick={onPlay}
            aria-label={`Play ${track.title} by ${track.artist}`}
            className="absolute inset-0 grid place-items-center rounded bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Play className="size-[18px] fill-current text-white" />
          </button>
        )}
      </div>

      <div className="min-w-0">
        <p className={cn("truncate text-[15px] leading-5", active ? "text-accent" : "text-fg")}>
          {track.title}
        </p>
        <p className="flex min-w-0 items-center gap-1.5 text-[13px] leading-5 text-fg-muted">
          <SourceIcon source={track.source} className="size-3.5 shrink-0" />
          <span className="sr-only">{SOURCE_LABEL[track.source]}:</span>
          {track.explicit && <ExplicitBadge />}
          <span className="truncate">{track.artist}</span>
        </p>
      </div>

      <div className="flex items-center gap-1">
        {actions}
        <span className="tabular w-12 text-right text-sm text-fg-muted">
          {formatDuration(track.durationMs)}
        </span>
      </div>
    </div>
  );
}

export function TrackRowSkeleton() {
  return (
    <div className="grid h-14 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 px-2">
      <div className="skeleton size-10 rounded" />
      <div className="space-y-2">
        <div className="skeleton h-3.5 w-2/3 rounded" />
        <div className="skeleton h-3 w-1/3 rounded" />
      </div>
      <div className="skeleton h-3 w-10 rounded" />
    </div>
  );
}
