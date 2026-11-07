"use client";

import { ChevronDown, ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { create } from "zustand";

import { DOCK_PRIORITY, MediaSlot } from "~/components/player/media-surface";
import { CrossfadeControl, Progress } from "~/components/player/player-bar";
import { QueueList } from "~/components/player/right-panel";
import { Artwork } from "~/components/tracks/artwork";
import { LikeButton } from "~/components/tracks/likes";
import { SourceIcon, SOURCE_LABEL } from "~/components/tracks/source-badge";
import { TrackMenuButton } from "~/components/tracks/track-menu";
import { IconButton } from "~/components/ui/button";
import { tintColor, useArtworkTint } from "~/lib/artwork-tint";
import { cn } from "~/lib/cn";
import { usePlayer } from "~/lib/player/store";
import { type PlayContext } from "~/lib/player/types";
import { DESKTOP_QUERY, useMediaQuery } from "~/lib/use-media-query";

type SheetView = "player" | "queue";

const useSheet = create<{ view: SheetView | null }>(() => ({ view: null }));

/** Over the page and the mini player. Menus and toasts (z-50) still open on top of it. */
const SHEET_Z = 40;
const SHEET_SLOT_PRIORITY = 3;
/** How far the sheet has to be pulled down before letting go closes it. */
const DISMISS_PX = 110;

const FROM: Record<PlayContext["type"], string> = {
  playlist: "Playing from playlist",
  search: "Playing from search",
  link: "Playing from a link",
  liked: "Playing from your library",
  history: "Playing from recently played",
  profile: "Playing from a profile",
  home: "Playing from home",
};

/** The player on phones: a mini player above the bottom navigation that opens a full view. */
export function MobilePlayer() {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const hasTrack = usePlayer((s) => Boolean(s.current));
  const view = useSheet((s) => s.view);
  const pathname = usePathname();

  // Following a link out of the sheet (to the playlist it's playing from, say) closes it.
  useEffect(() => {
    useSheet.setState({ view: null });
  }, [pathname]);

  if (desktop || !hasTrack) return null;
  return (
    <>
      <MiniPlayer />
      {view && <NowPlayingSheet view={view} />}
    </>
  );
}

function isVideo(surface: string | null) {
  return surface === "yt-a" || surface === "yt-b";
}

function MiniPlayer() {
  const current = usePlayer((s) => s.current);
  const surface = usePlayer((s) => s.surface);
  const status = usePlayer((s) => s.status);
  const error = usePlayer((s) => s.error);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const tint = useArtworkTint(current?.track.artworkUrl);
  if (!current) return null;

  const { track } = current;
  const playing = status === "playing" || status === "loading";

  return (
    <section aria-label="Player" className="shrink-0 px-2 pb-1">
      <div
        className="bg-ink-800 relative overflow-hidden rounded-lg shadow-[0_-8px_24px_rgb(0_0_0/0.35)] transition-colors duration-500"
        style={tint ? { backgroundColor: tintColor(tint, 20) } : undefined}
      >
        {/* YouTube needs at least 200x200 on screen while it plays; Spotify's preview player fits in 80. */}
        {surface && (
          <MediaSlot
            id="mini"
            priority={DOCK_PRIORITY}
            className={isVideo(surface) ? "aspect-video min-h-[200px] w-full" : "h-20 w-full"}
          />
        )}
        <div className="flex h-14 items-center gap-2 pr-1 pl-2">
          <button
            type="button"
            onClick={() => useSheet.setState({ view: "player" })}
            aria-haspopup="dialog"
            aria-label={`Now playing: ${track.title} by ${track.artist}. Open the full player`}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            {!surface && <Artwork src={track.artworkUrl} className="size-10 rounded" />}
            <span className="min-w-0">
              <span className="block truncate text-[13px] leading-tight font-semibold">{track.title}</span>
              <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
                <SourceIcon source={track.source} className="size-3 shrink-0" />
                <span className="sr-only">{SOURCE_LABEL[track.source]}:</span>
                <span className={cn("truncate", error ? "text-danger" : "text-fg-muted")}>{error ?? track.artist}</span>
              </span>
            </span>
          </button>
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

/**
 * Full-screen now playing view. It slides up over everything, closes with the chevron, Escape
 * or a pull down on the header, and also holds the queue.
 */
function NowPlayingSheet({ view }: { view: SheetView }) {
  const current = usePlayer((s) => s.current);
  const context = usePlayer((s) => s.context);
  const tint = useArtworkTint(current?.track.artworkUrl);
  const [closing, setClosing] = useState(false);
  const [pull, setPull] = useState(0);
  const [pulling, setPulling] = useState(false);
  const pullStart = useRef(0);
  const closeButton = useRef<HTMLButtonElement>(null);

  // Focus goes into the sheet when it opens and back to where it was when it closes.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus({ preventScroll: true });
    return () => previous?.focus({ preventScroll: true });
  }, []);

  // The slide-down normally finishes the close. If the animation never runs (a background tab
  // doesn't paint), close anyway.
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => useSheet.setState({ view: null }), 400);
    return () => window.clearTimeout(timer);
  }, [closing]);

  const close = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) useSheet.setState({ view: null });
    else setClosing(true);
  };

  if (!current) return null;
  const { track } = current;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={view === "queue" ? "Queue" : "Now playing"}
      onKeyDown={(e) => {
        // Escape inside an open menu closes the menu, not the sheet.
        if (e.key === "Escape" && !(e.target as Element).closest("[data-radix-popper-content-wrapper]")) close();
      }}
      onAnimationEnd={(e) => {
        if (closing && e.target === e.currentTarget) useSheet.setState({ view: null });
      }}
      className={cn(
        "bg-ink-900 fixed inset-0 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] motion-reduce:animate-none",
        closing ? "animate-sheet-down" : "animate-sheet-up",
      )}
      style={{
        zIndex: SHEET_Z,
        // The pull uses `translate` so it adds to the slide animation's `transform`.
        translate: pull ? `0 ${pull}px` : undefined,
        transition: pulling ? "none" : "translate 240ms var(--ease-out-quart)",
        backgroundImage: tint
          ? `linear-gradient(180deg, ${tintColor(tint, 30)} 0%, ${tintColor(tint, 15)} 50%, var(--color-ink-900) 90%)`
          : undefined,
      }}
    >
      <header
        onPointerDown={(e) => {
          if ((e.target as Element).closest("button, a")) return;
          pullStart.current = e.clientY;
          setPulling(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (pulling) setPull(Math.max(0, e.clientY - pullStart.current));
        }}
        onPointerUp={() => {
          if (!pulling) return;
          setPulling(false);
          if (pull > DISMISS_PX) close();
          else setPull(0);
        }}
        onPointerCancel={() => {
          setPulling(false);
          setPull(0);
        }}
        className="relative flex h-16 shrink-0 touch-none items-center gap-2 px-2"
      >
        <span aria-hidden className="absolute top-1.5 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-white/20" />
        <IconButton
          ref={closeButton}
          label={view === "queue" ? "Back to now playing" : "Close now playing"}
          tooltip={false}
          onClick={() => (view === "queue" ? useSheet.setState({ view: "player" }) : close())}
        >
          <ChevronDown className="size-6" />
        </IconButton>
        <div className="min-w-0 flex-1 text-center">
          {view === "queue" ? (
            <p className="text-[15px] font-semibold">Queue</p>
          ) : (
            <>
              <p className="text-fg-muted text-[11px] font-semibold tracking-[0.08em] uppercase">
                {context ? FROM[context.type] : "Now playing"}
              </p>
              {context &&
                (context.href ? (
                  <Link href={context.href} className="mt-0.5 block truncate text-[13px] font-semibold">
                    {context.title}
                  </Link>
                ) : (
                  <p className="mt-0.5 truncate text-[13px] font-semibold">{context.title}</p>
                ))}
            </>
          )}
        </div>
        {view === "player" ? (
          <TrackMenuButton track={track} className="size-9" />
        ) : (
          <span className="size-9 shrink-0" aria-hidden />
        )}
      </header>

      {view === "player" ? <PlayerView /> : <QueueView />}
    </div>
  );
}

function PlayerView() {
  const current = usePlayer((s) => s.current);
  const surface = usePlayer((s) => s.surface);
  const error = usePlayer((s) => s.error);
  if (!current) return null;
  const { track } = current;

  return (
    <div className="flex min-h-0 flex-1 flex-col px-6 pb-4">
      <div className="flex min-h-0 flex-1 items-center justify-center py-3">
        {surface ? (
          <MediaSlot
            id="sheet"
            priority={SHEET_SLOT_PRIORITY}
            zIndex={SHEET_Z + 1}
            className={cn(
              "w-full rounded-lg",
              isVideo(surface) ? "aspect-video min-h-[200px]" : "h-full max-h-[352px] min-h-[152px]",
            )}
          />
        ) : (
          <Artwork
            src={track.artworkUrl}
            eager
            className="aspect-square w-full max-w-[min(100%,44dvh)] rounded-lg shadow-[var(--shadow-art)]"
            iconClassName="max-h-20 max-w-20"
          />
        )}
      </div>

      <div className="mt-2 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display truncate text-[22px] leading-tight">{track.title}</p>
          <p className="text-fg-muted mt-1 flex min-w-0 items-center gap-1.5 text-[15px]">
            <SourceIcon source={track.source} className="size-4 shrink-0" />
            <span className="sr-only">{SOURCE_LABEL[track.source]}:</span>
            <span className="truncate">{track.artist}</span>
          </p>
        </div>
        <LikeButton track={track} size="lg" />
      </div>
      {error && (
        <p role="status" className="text-danger mt-2 text-[13px]">
          {error}
        </p>
      )}

      <div className="mt-4">
        <Progress stacked />
      </div>
      <SheetTransport />
      <div className="mt-3 flex items-center justify-between">
        <CrossfadeControl />
        <IconButton label="Queue" tooltip={false} onClick={() => useSheet.setState({ view: "queue" })}>
          <ListMusic className="size-5" />
        </IconButton>
      </div>
    </div>
  );
}

function SheetTransport() {
  const status = usePlayer((s) => s.status);
  const buffering = usePlayer((s) => s.buffering);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const { togglePlay, next, previous, toggleShuffle, cycleRepeat } = usePlayer.getState();
  const playing = status === "playing" || status === "loading";

  return (
    <div className="mt-2 flex items-center justify-between">
      <IconButton
        label={shuffle ? "Turn off shuffle" : "Shuffle"}
        active={shuffle}
        size="lg"
        tooltip={false}
        onClick={toggleShuffle}
      >
        <Shuffle className="size-6" />
        {shuffle && <ActiveDot />}
      </IconButton>
      <IconButton label="Previous" size="lg" tooltip={false} onClick={previous} className="text-fg">
        <SkipBack className="size-8 fill-current" />
      </IconButton>
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? "Pause" : "Play"}
        className="bg-fg text-ink-950 relative grid size-16 place-items-center rounded-full transition-transform active:scale-95"
      >
        {playing ? <Pause className="size-7 fill-current" /> : <Play className="ml-1 size-7 fill-current" />}
        {buffering && playing && (
          <span
            className="border-t-accent absolute -inset-1 animate-spin rounded-full border-2 border-transparent"
            aria-hidden
          />
        )}
      </button>
      <IconButton label="Next" size="lg" tooltip={false} onClick={next} className="text-fg">
        <SkipForward className="size-8 fill-current" />
      </IconButton>
      <IconButton
        label={repeat === "off" ? "Repeat" : repeat === "all" ? "Repeat one" : "Turn off repeat"}
        active={repeat !== "off"}
        size="lg"
        tooltip={false}
        onClick={cycleRepeat}
      >
        {repeat === "one" ? <Repeat1 className="size-6" /> : <Repeat className="size-6" />}
        {repeat !== "off" && <ActiveDot />}
      </IconButton>
    </div>
  );
}

function ActiveDot() {
  return <span className="absolute bottom-0 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current" aria-hidden />;
}

function QueueView() {
  const surface = usePlayer((s) => s.surface);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* A playing video has to stay on screen, so it comes along to the queue. */}
      {isVideo(surface) && (
        <div className="shrink-0 px-4 pb-3">
          <MediaSlot
            id="sheet"
            priority={SHEET_SLOT_PRIORITY}
            zIndex={SHEET_Z + 1}
            className="aspect-video min-h-[200px] w-full rounded-lg"
          />
        </div>
      )}
      <QueueList />
    </div>
  );
}
