"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useAddToPlaylist } from "~/components/playlists/use-playlist-actions";
import { TrackRow, TrackRowSkeleton } from "~/components/tracks/track-row";
import { Button, IconButton } from "~/components/ui/button";
import { resultTracks } from "~/lib/search-results";
import { trackKey } from "~/lib/types";
import { usePlayer } from "~/lib/player/store";
import { api } from "~/trpc/react";

/** Spotify's "Let's find something for your playlist": search inline and add without leaving. */
export function FindMore({
  playlist,
  heading,
  onClose,
}: {
  playlist: { id: string; title: string };
  heading: string;
  onClose?: () => void;
}) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const addToPlaylist = useAddToPlaylist();
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 400);
    return () => clearTimeout(id);
  }, [text]);

  const search = api.search.tracks.useQuery(
    { q },
    { enabled: q.length > 1, placeholderData: keepPreviousData, staleTime: 5 * 60_000, retry: false },
  );
  const tracks = resultTracks(search.data).slice(0, 10);

  return (
    <section className="mt-8 border-t border-white/[0.08] px-6 pt-8 pb-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{heading}</h2>
          <div className="bg-ink-800 mt-4 flex h-10 w-[min(100%,380px)] items-center gap-2 rounded-md px-3 focus-within:ring-2 focus-within:ring-white/30">
            <Search className="text-fg-muted size-[18px] shrink-0" aria-hidden />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Search for songs or videos, or paste a link"
              aria-label="Search for tracks to add"
              className="placeholder:text-fg-subtle min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            {text && (
              <button
                type="button"
                aria-label="Clear"
                onClick={() => setText("")}
                className="text-fg-muted hover:text-fg"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
        {onClose && (
          <IconButton label="Close" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        )}
      </div>

      <div className="mt-4 max-w-4xl">
        {search.isFetching && !search.data && Array.from({ length: 4 }, (_, i) => <TrackRowSkeleton key={i} />)}
        {q.length > 1 && search.data && tracks.length === 0 && (
          <p className="text-fg-muted py-6 text-sm">
            {search.data.isLink
              ? "That link doesn't point to a track or video we can add."
              : search.data.youtube.status === "disabled"
                ? "Searching isn't set up on this server yet. Paste a YouTube link instead."
                : `Nothing found for “${q}”.`}
          </p>
        )}
        {tracks.map((track, i) => (
          <TrackRow
            key={trackKey(track)}
            track={track}
            onPlay={() => usePlayer.getState().playTracks(tracks, i, { type: "search", title: `Search: ${q}` })}
            actions={
              <Button
                variant="outline"
                size="sm"
                disabled={adding === trackKey(track)}
                onClick={async () => {
                  setAdding(trackKey(track));
                  await addToPlaylist(playlist, [track]);
                  setAdding(null);
                }}
                className="mr-2"
              >
                Add
              </Button>
            }
          />
        ))}
      </div>
    </section>
  );
}
