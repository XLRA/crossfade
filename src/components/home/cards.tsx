"use client";

import Link from "next/link";

import { HoverPlayButton, usePlaylistPlayback } from "~/components/playlists/playlist-card";
import { useTrackStatus } from "~/components/player/track-status";
import { Artwork } from "~/components/tracks/artwork";
import { SourceIcon, SOURCE_LABEL } from "~/components/tracks/source-badge";
import { cn } from "~/lib/cn";
import { formatDuration } from "~/lib/format";
import { usePlayer } from "~/lib/player/store";
import { type TrackData } from "~/lib/types";
import { useTapToPlay } from "~/lib/use-tap-to-play";

/** A square track card for shelves. Pressing play starts the shelf from this track. */
export function TrackCard({ track, onPlay, className }: { track: TrackData; onPlay: () => void; className?: string }) {
  const status = useTrackStatus(track);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const tap = useTapToPlay(status ? togglePlay : onPlay);

  return (
    <div
      onDoubleClick={onPlay}
      onClick={tap}
      className={cn("group relative rounded-lg p-3 transition-colors duration-200 hover:bg-white/[0.06]", className)}
    >
      <div className="relative">
        <Artwork src={track.artworkUrl} className="aspect-square w-full rounded-md shadow-[var(--shadow-art)]" />
        <HoverPlayButton playing={status === "playing"} label={track.title} onClick={status ? togglePlay : onPlay} />
      </div>
      <p className={cn("mt-3 truncate font-semibold", status && "text-accent")} title={track.title}>
        {track.title}
      </p>
      <p className="text-fg-muted mt-1 flex min-w-0 items-center gap-1.5 text-sm">
        <SourceIcon source={track.source} className="size-3.5 shrink-0" />
        <span className="sr-only">{SOURCE_LABEL[track.source]}:</span>
        <span className="truncate">{track.artist}</span>
      </p>
    </div>
  );
}

/** A 16:9 card for YouTube videos, with the running time over the thumbnail. */
export function VideoCard({ track, onPlay, className }: { track: TrackData; onPlay: () => void; className?: string }) {
  const status = useTrackStatus(track);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const tap = useTapToPlay(status ? togglePlay : onPlay);

  return (
    <div
      onDoubleClick={onPlay}
      onClick={tap}
      className={cn("group relative rounded-lg p-3 transition-colors duration-200 hover:bg-white/[0.06]", className)}
    >
      <div className="relative overflow-hidden rounded-md shadow-[var(--shadow-art)]">
        <Artwork src={track.artworkUrl} className="aspect-video w-full" />
        {track.durationMs > 0 && (
          <span className="tabular absolute right-1.5 bottom-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold">
            {formatDuration(track.durationMs)}
          </span>
        )}
        <HoverPlayButton
          variant="center"
          playing={status === "playing"}
          label={track.title}
          onClick={status ? togglePlay : onPlay}
        />
      </div>
      <p className={cn("mt-2.5 line-clamp-2 leading-snug font-semibold", status && "text-accent")} title={track.title}>
        {track.title}
      </p>
      <p className="text-fg-muted mt-1 flex min-w-0 items-center gap-1.5 text-sm">
        <SourceIcon source={track.source} className="size-3.5 shrink-0" />
        <span className="sr-only">{SOURCE_LABEL[track.source]}:</span>
        <span className="truncate">{track.artist}</span>
      </p>
    </div>
  );
}

/** The compact tiles at the top of the home page: cover, name, and a play button on hover. */
export function QuickTile({
  id,
  href,
  title,
  cover,
}: {
  /** Playlist id, or "liked". */
  id: string;
  href: string;
  title: string;
  cover: React.ReactNode;
}) {
  const { isContext, playing, loading, play } = usePlaylistPlayback(id);

  return (
    <div className="group relative flex h-14 items-center gap-3 overflow-hidden rounded-md bg-white/[0.07] pr-2 transition-colors duration-200 hover:bg-white/[0.14] @3xl:h-16">
      <div className="aspect-square h-full shrink-0 shadow-[4px_0_14px_rgb(0_0_0/0.35)]">{cover}</div>
      <Link
        href={href}
        className={cn(
          "line-clamp-2 min-w-0 flex-1 text-[13px] leading-tight font-bold break-words after:absolute after:inset-0 @3xl:text-[15px]",
          isContext && "text-accent",
        )}
      >
        {title}
      </Link>
      <HoverPlayButton variant="tile" playing={playing} loading={loading} label={title} onClick={() => void play()} />
    </div>
  );
}
