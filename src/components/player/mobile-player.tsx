"use client";

import { Pause, Play } from "lucide-react";
import Link from "next/link";

import { DOCK_PRIORITY, MediaSlot } from "~/components/player/media-surface";
import { Artwork } from "~/components/tracks/artwork";
import { LikeButton } from "~/components/tracks/likes";
import { SourceIcon, SOURCE_LABEL } from "~/components/tracks/source-badge";
import { cn } from "~/lib/cn";
import { usePlayer } from "~/lib/player/store";
import { DESKTOP_QUERY, useMediaQuery } from "~/lib/use-media-query";

/** The player on phones: a compact bar above the bottom navigation. */
export function MobilePlayer() {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const hasTrack = usePlayer((s) => Boolean(s.current));
  if (desktop || !hasTrack) return null;
  return <MiniPlayer />;
}

function MiniPlayer() {
  const current = usePlayer((s) => s.current);
  const context = usePlayer((s) => s.context);
  const surface = usePlayer((s) => s.surface);
  const status = usePlayer((s) => s.status);
  const error = usePlayer((s) => s.error);
  const togglePlay = usePlayer((s) => s.togglePlay);
  if (!current) return null;

  const { track } = current;
  const playing = status === "playing" || status === "loading";
  const video = surface === "yt-a" || surface === "yt-b";

  const info = (
    <>
      {!surface && <Artwork src={track.artworkUrl} className="size-10 rounded" />}
      <span className="min-w-0">
        <span className="block truncate text-[13px] leading-tight font-semibold">{track.title}</span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
          <SourceIcon source={track.source} className="size-3 shrink-0" />
          <span className="sr-only">{SOURCE_LABEL[track.source]}:</span>
          <span className={cn("truncate", error ? "text-danger" : "text-fg-muted")}>{error ?? track.artist}</span>
        </span>
      </span>
    </>
  );

  return (
    <section aria-label="Player" className="shrink-0 px-2 pb-1">
      <div className="bg-ink-800 relative overflow-hidden rounded-lg shadow-[0_-8px_24px_rgb(0_0_0/0.35)]">
        {/* YouTube needs at least 200x200 on screen while it plays; Spotify's preview player fits in 80. */}
        {surface && (
          <MediaSlot
            id="mini"
            priority={DOCK_PRIORITY}
            className={video ? "aspect-video min-h-[200px] w-full" : "h-20 w-full"}
          />
        )}
        <div className="flex h-14 items-center gap-2 pr-1 pl-2">
          {context?.href ? (
            <Link href={context.href} className="flex min-w-0 flex-1 items-center gap-2.5">
              {info}
            </Link>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2.5">{info}</div>
          )}
          <LikeButton track={track} />
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="text-fg grid size-10 shrink-0 place-items-center rounded-full active:scale-95"
          >
            {playing ? <Pause className="size-6 fill-current" /> : <Play className="size-6 fill-current" />}
          </button>
        </div>
        <MiniProgress />
      </div>
    </section>
  );
}

/** A hairline along the bottom edge. Seeking happens in the full view. */
function MiniProgress() {
  const position = usePlayer((s) => s.positionMs);
  const duration = usePlayer((s) => s.durationMs);
  const fraction = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <div className="absolute inset-x-2 bottom-0 h-0.5 overflow-hidden rounded-full bg-white/15" aria-hidden>
      <div className="bg-fg h-full origin-left" style={{ transform: `scaleX(${fraction})` }} />
    </div>
  );
}
