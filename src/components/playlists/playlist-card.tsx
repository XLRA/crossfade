"use client";

import { LoaderCircle, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { PlaylistCover } from "~/components/playlists/playlist-cover";
import { cn } from "~/lib/cn";
import { usePlayer } from "~/lib/player/store";
import { type PlayContext } from "~/lib/player/types";
import { type TrackData } from "~/lib/types";
import { api } from "~/trpc/react";

export type PlaylistCardData = { id: string; title: string; covers: string[]; subtitle: string };

/**
 * Play/pause for a playlist shown somewhere other than its own page: loads its tracks on the
 * first press, toggles playback after that. "liked" plays Liked Songs.
 */
export function usePlaylistPlayback(id: string) {
  const utils = api.useUtils();
  const isContext = usePlayer((s) =>
    id === "liked" ? s.context?.type === "liked" : s.context?.type === "playlist" && s.context.id === id,
  );
  const playing = usePlayer((s) => s.status === "playing" || s.status === "loading") && isContext;
  const [loading, setLoading] = useState(false);

  const play = async () => {
    if (isContext) return usePlayer.getState().togglePlay();
    setLoading(true);
    try {
      let tracks: TrackData[];
      let context: PlayContext;
      if (id === "liked") {
        tracks = (await utils.likes.list.fetch()).map((like) => like.track);
        context = { type: "liked", title: "Liked Songs", href: "/liked" };
      } else {
        const data = await utils.playlist.byId.fetch({ id });
        tracks = data.tracks.map((entry) => entry.track);
        context = { type: "playlist", id, title: data.title, href: `/playlist/${id}` };
      }
      if (tracks.length === 0) {
        toast("Nothing to play here yet.");
        return;
      }
      const { shuffle } = usePlayer.getState();
      usePlayer.getState().playTracks(tracks, shuffle ? Math.floor(Math.random() * tracks.length) : 0, context);
    } catch {
      toast.error("Couldn't load that playlist.");
    } finally {
      setLoading(false);
    }
  };

  return { isContext, playing, loading, play };
}

const HOVER_PLAY = {
  /** Bottom right of a card's artwork, sliding up as it appears. */
  card: {
    button: "absolute right-2 bottom-2 size-12",
    shown: "translate-y-0 opacity-100",
    hidden:
      "translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100",
    icon: "size-5",
  },
  /** Centered over a video thumbnail. */
  center: {
    button: "absolute top-1/2 left-1/2 size-12 -translate-x-1/2 -translate-y-1/2",
    shown: "opacity-100",
    hidden: "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
    icon: "size-5",
  },
  /** Small, at the end of a quick-access tile. Touch screens only show it while playing. */
  tile: {
    button: "relative size-9 shrink-0",
    shown: "opacity-100",
    hidden: "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:hidden",
    icon: "size-4",
  },
} as const;

/** The round accent play button that appears over cards and tiles on hover. */
export function HoverPlayButton({
  playing,
  loading,
  label,
  onClick,
  variant = "card",
}: {
  playing: boolean;
  loading?: boolean;
  label: string;
  onClick: () => void;
  variant?: keyof typeof HOVER_PLAY;
}) {
  const style = HOVER_PLAY[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={playing ? `Pause ${label}` : `Play ${label}`}
      className={cn(
        "bg-accent text-accent-ink hover:bg-accent-hover z-10 grid place-items-center rounded-full shadow-[0_8px_24px_rgb(0_0_0/0.45)] transition-[opacity,translate,scale,background-color] duration-200 hover:scale-105",
        style.button,
        playing || loading ? style.shown : style.hidden,
      )}
    >
      {loading ? (
        <LoaderCircle className={cn(style.icon, "animate-spin")} />
      ) : playing ? (
        <Pause className={cn(style.icon, "fill-current")} />
      ) : (
        <Play className={cn(style.icon, "ml-0.5 fill-current")} />
      )}
    </button>
  );
}

/**
 * A playlist tile for grids and shelves. The whole card opens the playlist; the play button
 * that slides up on hover starts it without leaving the page.
 */
export function PlaylistCard({
  playlist,
  eager,
  className,
}: {
  playlist: PlaylistCardData;
  eager?: boolean;
  className?: string;
}) {
  const { isContext, playing, loading, play } = usePlaylistPlayback(playlist.id);

  return (
    <div
      className={cn("group relative rounded-lg p-3 transition-colors duration-200 hover:bg-white/[0.06]", className)}
    >
      <div className="relative">
        <PlaylistCover
          covers={playlist.covers}
          eager={eager}
          className="aspect-square w-full rounded-md shadow-[var(--shadow-art)]"
        />
        <HoverPlayButton playing={playing} loading={loading} label={playlist.title} onClick={() => void play()} />
      </div>
      <Link
        href={`/playlist/${playlist.id}`}
        className={cn(
          "mt-3 block truncate font-semibold after:absolute after:inset-0 after:rounded-lg",
          isContext && "text-accent",
        )}
      >
        {playlist.title}
      </Link>
      <p className="text-fg-muted mt-1 line-clamp-2 text-sm">{playlist.subtitle}</p>
    </div>
  );
}

export function PlaylistCardSkeleton() {
  return (
    <div className="p-3">
      <div className="skeleton aspect-square w-full rounded-md" />
      <div className="skeleton mt-3 h-4 w-3/4 rounded" />
      <div className="skeleton mt-2 h-3 w-1/2 rounded" />
    </div>
  );
}
