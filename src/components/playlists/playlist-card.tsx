"use client";

import { LoaderCircle, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { PlaylistCover } from "~/components/playlists/playlist-cover";
import { cn } from "~/lib/cn";
import { usePlayer } from "~/lib/player/store";
import { api } from "~/trpc/react";

export type PlaylistCardData = { id: string; title: string; covers: string[]; subtitle: string };

/**
 * A playlist tile for grids and shelves. The whole card opens the playlist; the play button
 * that slides up on hover starts it without leaving the page.
 */
export function PlaylistCard({ playlist, eager }: { playlist: PlaylistCardData; eager?: boolean }) {
  const utils = api.useUtils();
  const isContext = usePlayer((s) => s.context?.type === "playlist" && s.context.id === playlist.id);
  const playing = usePlayer((s) => s.status === "playing" || s.status === "loading") && isContext;
  const [loading, setLoading] = useState(false);

  const play = async () => {
    if (isContext) return usePlayer.getState().togglePlay();
    setLoading(true);
    try {
      const data = await utils.playlist.byId.fetch({ id: playlist.id });
      if (data.tracks.length === 0) {
        toast("This playlist is empty.");
        return;
      }
      usePlayer.getState().playTracks(
        data.tracks.map((entry) => entry.track),
        0,
        { type: "playlist", id: playlist.id, title: data.title, href: `/playlist/${playlist.id}` },
      );
    } catch {
      toast.error("Couldn't load that playlist.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="group relative rounded-lg p-3 transition-colors duration-200 hover:bg-white/[0.06]">
      <div className="relative">
        <PlaylistCover
          covers={playlist.covers}
          eager={eager}
          className="aspect-square w-full rounded-md shadow-[var(--shadow-art)]"
        />
        <button
          type="button"
          onClick={() => void play()}
          aria-label={playing ? `Pause ${playlist.title}` : `Play ${playlist.title}`}
          className={cn(
            "bg-accent text-accent-ink hover:bg-accent-hover absolute right-2 bottom-2 z-10 grid size-12 place-items-center rounded-full shadow-[0_8px_24px_rgb(0_0_0/0.45)] transition-all duration-200 hover:scale-105",
            playing || loading
              ? "translate-y-0 opacity-100"
              : "translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100",
          )}
        >
          {loading ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : playing ? (
            <Pause className="size-5 fill-current" />
          ) : (
            <Play className="ml-0.5 size-5 fill-current" />
          )}
        </button>
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
