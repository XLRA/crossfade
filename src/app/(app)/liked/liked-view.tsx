"use client";

import { Heart, Search, Shuffle, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { LikedCover } from "~/components/tracks/likes";
import { Avatar } from "~/components/ui/avatar";
import { Button, IconButton } from "~/components/ui/button";
import { PlayButton } from "~/components/ui/play-button";
import { formatLongDuration, plural } from "~/lib/format";
import { usePlayer } from "~/lib/player/store";
import { type PlayContext } from "~/lib/player/types";
import { trackKey } from "~/lib/types";
import { api } from "~/trpc/react";
import { type PlaylistEntry, TrackTable } from "../playlist/[id]/track-table";

type Owner = { id: string; name: string | null; username: string | null; image: string | null };

const CONTEXT: PlayContext = { type: "liked", title: "Liked Songs", href: "/liked" };

export function LikedView({ owner }: { owner: Owner }) {
  const list = api.likes.list.useQuery(undefined, { staleTime: 30_000 });
  const [filter, setFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const isContext = usePlayer((s) => s.context?.type === "liked");
  const status = usePlayer((s) => s.status);
  const shuffle = usePlayer((s) => s.shuffle);
  const currentKey = usePlayer((s) => (s.current ? trackKey(s.current.track) : null));
  const playing = isContext && (status === "playing" || status === "loading");

  // Shaped like playlist entries so the playlist table can show them; "date added" is when it was liked.
  const entries: PlaylistEntry[] = useMemo(
    () =>
      (list.data ?? []).map((like, position) => ({
        entryId: trackKey(like.track),
        position,
        addedAt: like.likedAt,
        addedBy: null,
        track: like.track,
      })),
    [list.data],
  );

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.track.title.toLowerCase().includes(q) || e.track.artist.toLowerCase().includes(q));
  }, [entries, filter]);

  const total = entries.reduce((sum, e) => sum + e.track.durationMs, 0);
  const playAt = (index: number) =>
    usePlayer.getState().playTracks(
      entries.map((e) => e.track),
      index,
      CONTEXT,
    );
  const playAll = () => {
    if (isContext) return usePlayer.getState().togglePlay();
    if (entries.length === 0) return;
    playAt(shuffle ? Math.floor(Math.random() * entries.length) : 0);
  };

  return (
    <div className="@container relative min-h-full">
      <header
        className="flex flex-col gap-6 px-6 pt-20 pb-6 @xl:flex-row @xl:items-end"
        style={{ background: "linear-gradient(180deg, hsl(32 48% 34%) 0%, hsl(24 36% 20%) 100%)" }}
      >
        <LikedCover className="size-[min(232px,60cqi)] self-center rounded-md shadow-[var(--shadow-art)] @xl:size-[min(232px,30cqi)] @xl:self-auto" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Playlist</p>
          <h1 className="font-display mt-1 text-[clamp(36px,9cqi,92px)] leading-[1.02]">Liked Songs</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
            <Avatar src={owner.image} name={owner.name ?? owner.username} seed={owner.id} size={24} />
            <span className="font-semibold">{owner.name ?? owner.username}</span>
            <span className="text-white/70">·</span>
            <span>{plural(entries.length, "song")}</span>
            {total > 0 && <span className="text-white/70">, {formatLongDuration(total)}</span>}
          </p>
        </div>
      </header>

      <div style={{ background: "linear-gradient(180deg, hsl(28 30% 15%) 0, var(--color-ink-900) 240px)" }}>
        <div className="flex items-center gap-3 px-6 py-5">
          <PlayButton playing={playing} onClick={playAll} label="Liked Songs" disabled={entries.length === 0} />
          <IconButton
            label={shuffle ? "Turn off shuffle" : "Shuffle"}
            size="lg"
            active={shuffle}
            onClick={() => usePlayer.getState().toggleShuffle()}
          >
            <Shuffle className="size-6" />
          </IconButton>

          <div className="ml-auto flex items-center">
            {filterOpen ? (
              <div className="animate-fade-in flex h-9 w-[min(240px,40vw)] items-center gap-2 rounded-md bg-white/[0.08] px-2.5">
                <Search className="text-fg-muted size-4 shrink-0" aria-hidden />
                <input
                  autoFocus
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setFilter("");
                      setFilterOpen(false);
                    }
                  }}
                  placeholder="Search in Liked Songs"
                  aria-label="Search in Liked Songs"
                  className="placeholder:text-fg-subtle min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                />
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setFilter("");
                    setFilterOpen(false);
                  }}
                  className="text-fg-muted hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              entries.length > 0 && (
                <IconButton label="Search in Liked Songs" onClick={() => setFilterOpen(true)}>
                  <Search className="size-[18px]" />
                </IconButton>
              )
            )}
          </div>
        </div>

        {list.isLoading ? null : entries.length === 0 ? (
          <div className="mx-auto max-w-md px-6 py-16 text-center">
            <span className="bg-ink-800 mx-auto grid size-16 place-items-center rounded-full">
              <Heart className="text-fg-muted size-7" />
            </span>
            <p className="font-display mt-5 text-2xl">Songs you like will show up here</p>
            <p className="text-fg-muted mt-2">Tap the heart on any track or video to save it.</p>
            <Button asChild className="mt-6">
              <Link href="/search">Find something</Link>
            </Button>
          </div>
        ) : (
          <div className="px-6 pb-12">
            <TrackTable
              entries={visible}
              canEdit={false}
              showAddedBy={false}
              playingEntryKey={isContext ? currentKey : null}
              isPlaying={playing}
              sortable={false}
              playlistId="liked"
              onPlay={(entry) => playAt(entries.findIndex((e) => e.entryId === entry.entryId))}
              onTogglePlay={() => usePlayer.getState().togglePlay()}
              onMove={() => undefined}
              onRemove={() => undefined}
            />
            {visible.length === 0 && (
              <p className="text-fg-muted py-10 text-center text-sm">No songs match &ldquo;{filter}&rdquo;.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
