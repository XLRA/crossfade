"use client";

import {
  CircleAlert,
  ListMusic,
  MonitorPlay,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CrossfadeIcon } from "~/components/brand/logo";
import { Artwork } from "~/components/tracks/artwork";
import { SourceIcon, SOURCE_LABEL } from "~/components/tracks/source-badge";
import { IconButton } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Slider } from "~/components/ui/slider";
import { Tooltip } from "~/components/ui/tooltip";
import { cn } from "~/lib/cn";
import { formatDuration } from "~/lib/format";
import { usePlayer } from "~/lib/player/store";

export function PlayerBar() {
  return (
    <footer
      aria-label="Player"
      className="hidden h-[76px] shrink-0 grid-cols-[minmax(200px,1fr)_minmax(340px,1.5fr)_minmax(200px,1fr)] items-center gap-4 px-2 md:grid"
    >
      <NowPlaying />
      <Transport />
      <Extras />
    </footer>
  );
}

function NowPlaying() {
  const current = usePlayer((s) => s.current);
  const error = usePlayer((s) => s.error);
  const engine = usePlayer((s) => s.engine);
  const panel = usePlayer((s) => s.panel);
  const togglePanel = usePlayer((s) => s.togglePanel);
  const context = usePlayer((s) => s.context);

  if (!current) return <div />;
  const { track } = current;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <button
        type="button"
        onClick={() => togglePanel("nowPlaying")}
        aria-label={panel === "nowPlaying" ? "Hide now playing view" : "Show now playing view"}
        className="group relative shrink-0 rounded-md"
      >
        <Artwork src={track.artworkUrl} className="size-14 rounded-md" />
        <span className="absolute inset-0 rounded-md bg-black/0 transition-colors group-hover:bg-black/40" />
      </button>
      <div className="min-w-0">
        {context?.href ? (
          <Link href={context.href} className="block truncate text-sm font-medium text-fg hover:underline">
            {track.title}
          </Link>
        ) : (
          <p className="truncate text-sm font-medium text-fg">{track.title}</p>
        )}
        {error ? (
          <p className="flex items-center gap-1.5 truncate text-xs text-danger" role="status">
            <CircleAlert className="size-3.5 shrink-0" />
            <span className="truncate">{error}</span>
          </p>
        ) : (
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
            <SourceIcon source={track.source} className="size-3 shrink-0" />
            <span className="sr-only">{SOURCE_LABEL[track.source]}:</span>
            <span className="truncate">{track.artist}</span>
            {engine === "spotify-embed" && (
              <Tooltip label="Spotify plays 30-second previews unless you're signed in to Spotify in this browser, or connect a Premium account.">
                <span className="ml-1 shrink-0 rounded-sm bg-white/10 px-1.5 py-px text-[10px] font-semibold tracking-wide text-fg-muted uppercase">
                  Preview
                </span>
              </Tooltip>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function Transport() {
  const hasTrack = usePlayer((s) => Boolean(s.current));
  const status = usePlayer((s) => s.status);
  const buffering = usePlayer((s) => s.buffering);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const { togglePlay, next, previous, toggleShuffle, cycleRepeat } = usePlayer.getState();
  const playing = status === "playing" || status === "loading";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <IconButton label={shuffle ? "Turn off shuffle" : "Shuffle"} active={shuffle} onClick={toggleShuffle} disabled={!hasTrack}>
          <Shuffle className="size-[18px]" />
          {shuffle && <Dot />}
        </IconButton>
        <IconButton label="Previous" onClick={previous} disabled={!hasTrack}>
          <SkipBack className="size-5 fill-current" />
        </IconButton>
        <Tooltip label={playing ? "Pause" : "Play"}>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!hasTrack}
            aria-label={playing ? "Pause" : "Play"}
            className="relative mx-1.5 grid size-9 place-items-center rounded-full bg-fg text-ink-950 transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          >
            {playing ? <Pause className="size-[18px] fill-current" /> : <Play className="ml-0.5 size-[18px] fill-current" />}
            {buffering && playing && (
              <span className="absolute -inset-1 animate-spin rounded-full border-2 border-transparent border-t-accent" aria-hidden />
            )}
          </button>
        </Tooltip>
        <IconButton label="Next" onClick={next} disabled={!hasTrack}>
          <SkipForward className="size-5 fill-current" />
        </IconButton>
        <IconButton
          label={repeat === "off" ? "Repeat" : repeat === "all" ? "Repeat one" : "Turn off repeat"}
          active={repeat !== "off"}
          onClick={cycleRepeat}
          disabled={!hasTrack}
        >
          {repeat === "one" ? <Repeat1 className="size-[18px]" /> : <Repeat className="size-[18px]" />}
          {repeat !== "off" && <Dot />}
        </IconButton>
      </div>
      <Progress />
    </div>
  );
}

function Dot() {
  return <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current" aria-hidden />;
}

function Progress() {
  const position = usePlayer((s) => s.positionMs);
  const duration = usePlayer((s) => s.durationMs);
  const hasTrack = usePlayer((s) => Boolean(s.current));
  const seek = usePlayer((s) => s.seek);
  const [dragging, setDragging] = useState<number | null>(null);

  const shown = dragging ?? position;
  return (
    <div className="flex w-full max-w-[640px] items-center gap-2">
      <span className="tabular w-10 text-right text-xs text-fg-muted">{hasTrack ? formatDuration(shown) : ""}</span>
      <Slider
        label="Seek"
        value={shown}
        max={Math.max(duration, 1)}
        step={1000}
        disabled={!hasTrack || duration <= 0}
        valueText={`${formatDuration(shown)} of ${formatDuration(duration)}`}
        onChange={setDragging}
        onCommit={(ms) => {
          seek(ms);
          setDragging(null);
        }}
      />
      <span className="tabular w-10 text-xs text-fg-muted">{hasTrack ? formatDuration(duration) : ""}</span>
    </div>
  );
}

function Extras() {
  const panel = usePlayer((s) => s.panel);
  const togglePanel = usePlayer((s) => s.togglePanel);
  const hasTrack = usePlayer((s) => Boolean(s.current));

  return (
    <div className="flex items-center justify-end gap-0.5">
      <IconButton
        label="Now playing view"
        active={panel === "nowPlaying"}
        onClick={() => togglePanel("nowPlaying")}
        disabled={!hasTrack}
        className="hidden lg:inline-grid"
      >
        <MonitorPlay className="size-[18px]" />
        {panel === "nowPlaying" && <Dot />}
      </IconButton>
      <IconButton label="Queue" active={panel === "queue"} onClick={() => togglePanel("queue")}>
        <ListMusic className="size-[18px]" />
        {panel === "queue" && <Dot />}
      </IconButton>
      <CrossfadeControl />
      <Volume />
    </div>
  );
}

function CrossfadeControl() {
  const seconds = usePlayer((s) => s.crossfadeSeconds);
  const setCrossfade = usePlayer((s) => s.setCrossfade);
  return (
    <Popover>
      <Tooltip label={seconds > 0 ? `Crossfade: ${seconds} s` : "Crossfade: off"}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Crossfade settings"
            className={cn(
              "relative grid size-9 place-items-center rounded-full transition-colors",
              seconds > 0 ? "text-accent hover:text-accent-hover" : "text-fg-muted hover:text-fg",
            )}
          >
            <CrossfadeIcon className="size-[19px]" />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent side="top" align="end">
        <div className="flex items-baseline justify-between">
          <p className="font-semibold">Crossfade</p>
          <p className="tabular text-fg-muted">{seconds > 0 ? `${seconds} s` : "Off"}</p>
        </div>
        <p className="mt-1 text-[13px] leading-snug text-fg-muted">
          Blend the end of each track into the start of the next. The volumes follow an
          equal-power curve, so the mix doesn&apos;t dip in the middle.
        </p>
        <Slider
          label="Crossfade length in seconds"
          value={seconds}
          max={12}
          step={1}
          valueText={seconds > 0 ? `${seconds} seconds` : "Off"}
          onChange={setCrossfade}
          className="mt-4"
        />
        <div className="mt-1.5 flex justify-between text-[11px] text-fg-subtle">
          <span>Off</span>
          <span>12 s</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Volume() {
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const setVolume = usePlayer((s) => s.setVolume);
  const toggleMute = usePlayer((s) => s.toggleMute);
  const level = muted ? 0 : volume;
  const Icon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;

  return (
    <div className="flex items-center gap-1">
      <IconButton label={level === 0 ? "Unmute" : "Mute"} onClick={toggleMute}>
        <Icon className="size-[18px]" />
      </IconButton>
      <Slider
        label="Volume"
        value={level * 100}
        max={100}
        step={1}
        valueText={`${Math.round(level * 100)}%`}
        onChange={(v) => setVolume(v / 100)}
        className="w-[96px] lg:w-[110px]"
      />
    </div>
  );
}
