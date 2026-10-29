"use client";

import { Ellipsis, Link2, ListEnd, Pencil, Search, Shuffle, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { PlaylistCover } from "~/components/playlists/playlist-cover";
import { SOURCE_LABEL, SourceIcon } from "~/components/tracks/source-badge";
import { Avatar } from "~/components/ui/avatar";
import { Button, IconButton } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "~/components/ui/menu";
import { PlayButton } from "~/components/ui/play-button";
import { absoluteUrl } from "~/lib/base-path";
import { cn } from "~/lib/cn";
import { formatLongDuration, plural } from "~/lib/format";
import { usePlayer } from "~/lib/player/store";
import { type PlayContext } from "~/lib/player/types";
import { trackKey } from "~/lib/types";
import { api } from "~/trpc/react";
import { EditDetailsDialog } from "./edit-details-dialog";
import { FindMore } from "./find-more";
import { type PlaylistData, type PlaylistEntry, TrackTable } from "./track-table";

/** A stable, muted hue per playlist for the header wash. */
function hueOf(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  return hash % 360;
}

export function PlaylistView({ id }: { id: string }) {
  const query = api.playlist.byId.useQuery(
    { id },
    { retry: (count, error) => error.data?.code !== "NOT_FOUND" && count < 2 },
  );

  if (query.isLoading) return <PlaylistSkeleton />;
  if (!query.data) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="font-display text-3xl">Couldn&apos;t find that playlist</p>
        <p className="text-fg-muted mt-3">
          {query.error?.data?.code === "NOT_FOUND"
            ? "It may have been deleted, or it isn't shared with you."
            : "Something went wrong loading it. Try again in a moment."}
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    );
  }
  return <Playlist playlist={query.data} />;
}

function Playlist({ playlist }: { playlist: PlaylistData }) {
  const router = useRouter();
  const utils = api.useUtils();
  const hue = hueOf(playlist.id);
  const canEdit = playlist.role === "owner" || playlist.role === "editor";
  const isOwner = playlist.role === "owner";
  const entries = playlist.tracks;

  const [filter, setFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [findMore, setFindMore] = useState(false);

  const isContext = usePlayer((s) => s.context?.type === "playlist" && s.context.id === playlist.id);
  const status = usePlayer((s) => s.status);
  const shuffle = usePlayer((s) => s.shuffle);
  const currentKey = usePlayer((s) => (s.current ? trackKey(s.current.track) : null));
  const playing = isContext && (status === "playing" || status === "loading");

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.track.title.toLowerCase().includes(q) || e.track.artist.toLowerCase().includes(q));
  }, [entries, filter]);

  const context: PlayContext = {
    type: "playlist",
    id: playlist.id,
    title: playlist.title,
    href: `/playlist/${playlist.id}`,
  };
  const playAt = (index: number) =>
    usePlayer.getState().playTracks(
      entries.map((e) => e.track),
      index,
      context,
    );
  const playEntry = (entry: PlaylistEntry) => playAt(entries.findIndex((e) => e.entryId === entry.entryId));
  const playAll = () => {
    if (isContext) return usePlayer.getState().togglePlay();
    if (entries.length === 0) return;
    playAt(shuffle ? Math.floor(Math.random() * entries.length) : 0);
  };

  const setEntries = (update: (list: PlaylistEntry[]) => PlaylistEntry[]) =>
    utils.playlist.byId.setData({ id: playlist.id }, (old) => (old ? { ...old, tracks: update(old.tracks) } : old));

  const move = api.playlist.moveEntry.useMutation({
    onError: (error) => {
      toast.error(error.message);
      void utils.playlist.byId.invalidate({ id: playlist.id });
    },
  });
  const remove = api.playlist.removeEntries.useMutation({
    onSuccess: () => void utils.playlist.library.invalidate(),
    onError: (error) => {
      toast.error(error.message);
      void utils.playlist.byId.invalidate({ id: playlist.id });
    },
  });
  const destroy = api.playlist.delete.useMutation({
    onSuccess: () => {
      void utils.playlist.library.invalidate();
      toast("Removed from your library");
      router.push("/");
    },
    onError: (error) => toast.error(error.message),
  });

  const onMove = (entryId: string, toIndex: number) => {
    setEntries((list) => {
      const from = list.findIndex((e) => e.entryId === entryId);
      if (from < 0) return list;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(toIndex, 0, moved!);
      return next.map((e, i) => ({ ...e, position: i }));
    });
    move.mutate({ playlistId: playlist.id, entryId, toIndex });
  };

  const onRemove = (entry: PlaylistEntry) => {
    setEntries((list) => list.filter((e) => e.entryId !== entry.entryId).map((e, i) => ({ ...e, position: i })));
    remove.mutate({ playlistId: playlist.id, entryIds: [entry.entryId] });
    toast(`Removed from ${playlist.title}`);
  };

  // Sticky bar: show the title and a play button once the header scrolls away.
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry!.isIntersecting), {
      root: document.getElementById("main"),
      rootMargin: "-64px 0px 0px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const counts = useMemo(() => {
    const yt = entries.filter((e) => e.track.source === "YOUTUBE").length;
    return { youtube: yt, spotify: entries.length - yt };
  }, [entries]);

  // Sized against the page's own width (container query units), not the window: the side
  // panels can leave the main area narrow on a wide screen.
  const titleSize =
    playlist.title.length > 40
      ? "text-[clamp(26px,4.6cqi,48px)]"
      : playlist.title.length > 18
        ? "text-[clamp(30px,6.4cqi,64px)]"
        : "text-[clamp(36px,9cqi,92px)]";

  return (
    <div className="@container relative min-h-full">
      <div
        className={cn(
          "sticky top-0 z-20 -mb-16 flex h-16 items-center gap-3 px-6 transition-[background-color,box-shadow] duration-200",
          stuck ? "shadow-[0_6px_16px_rgb(0_0_0/0.35)]" : "pointer-events-none",
        )}
        style={{
          backgroundColor: stuck ? `hsl(${hue} 28% 22%)` : "transparent",
        }}
      >
        <div
          className={cn(
            "flex min-w-0 items-center gap-3 transition-opacity duration-200",
            stuck ? "opacity-100" : "opacity-0",
          )}
        >
          <PlayButton playing={playing} onClick={playAll} size="sm" disabled={entries.length === 0} />
          <p className="truncate text-xl font-bold">{playlist.title}</p>
        </div>
      </div>

      <header
        className="flex flex-col gap-6 px-6 pt-20 pb-6 @xl:flex-row @xl:items-end"
        style={{
          background: `linear-gradient(180deg, hsl(${hue} 34% 36%) 0%, hsl(${hue} 30% 22%) 100%)`,
        }}
      >
        <PlaylistCover
          covers={playlist.covers}
          eager
          className="size-[min(232px,60cqi)] self-center rounded-md shadow-[var(--shadow-art)] @xl:size-[min(232px,30cqi)] @xl:self-auto"
        />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            Playlist
            {playlist.importSource && (
              <>
                <span className="text-white/60" aria-hidden>
                  ·
                </span>
                <SourceIcon source={playlist.importSource} className="size-3.5" />
                Imported from {SOURCE_LABEL[playlist.importSource]}
              </>
            )}
          </p>
          {isOwner ? (
            <button type="button" onClick={() => setEditing(true)} className="mt-1 block max-w-full text-left">
              <h1 className={cn("font-display line-clamp-2 leading-[1.02] break-words", titleSize)}>
                {playlist.title}
              </h1>
            </button>
          ) : (
            <h1 className={cn("font-display mt-1 line-clamp-2 leading-[1.02] break-words", titleSize)}>
              {playlist.title}
            </h1>
          )}
          {playlist.description && (
            <p className="mt-3 line-clamp-2 max-w-3xl text-sm text-white/70">{playlist.description}</p>
          )}
          <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
            <Avatar
              src={playlist.owner.image}
              name={playlist.owner.name ?? playlist.owner.username}
              seed={playlist.owner.id}
              size={24}
            />
            <span className="font-semibold">{playlist.owner.name ?? playlist.owner.username}</span>
            <span className="text-white/70">·</span>
            <span>{plural(entries.length, "track")}</span>
            {playlist.totalDurationMs > 0 && (
              <span className="text-white/70">, {formatLongDuration(playlist.totalDurationMs)}</span>
            )}
            {counts.spotify > 0 && counts.youtube > 0 && (
              <span className="text-white/70">
                · {counts.spotify} Spotify, {counts.youtube} YouTube
              </span>
            )}
          </p>
        </div>
      </header>

      <div
        style={{
          background: `linear-gradient(180deg, hsl(${hue} 26% 16%) 0, var(--color-ink-900) 240px)`,
        }}
      >
        <div ref={sentinel} />
        <div className="flex items-center gap-3 px-6 py-5">
          <PlayButton playing={playing} onClick={playAll} disabled={entries.length === 0} />
          <IconButton
            label={shuffle ? "Turn off shuffle" : "Shuffle"}
            size="lg"
            active={shuffle}
            onClick={() => usePlayer.getState().toggleShuffle()}
          >
            <Shuffle className="size-6" />
          </IconButton>
          <Menu modal={false}>
            <MenuTrigger asChild>
              <IconButton label={`More options for ${playlist.title}`} size="lg" tooltip={false}>
                <Ellipsis className="size-6" />
              </IconButton>
            </MenuTrigger>
            <MenuContent align="start">
              <MenuItem
                disabled={entries.length === 0}
                onSelect={() => {
                  usePlayer.getState().addToQueue(entries.map((e) => e.track));
                  toast(`Added ${plural(entries.length, "track")} to queue`);
                }}
              >
                <ListEnd />
                Add to queue
              </MenuItem>
              {isOwner && (
                <>
                  <MenuItem onSelect={() => setEditing(true)}>
                    <Pencil />
                    Edit details
                  </MenuItem>
                  <MenuItem destructive onSelect={() => setConfirmDelete(true)}>
                    <Trash2 />
                    Delete
                  </MenuItem>
                </>
              )}
              <MenuSeparator />
              <MenuItem
                onSelect={() => {
                  void navigator.clipboard
                    .writeText(absoluteUrl(`/playlist/${playlist.id}`))
                    .then(() => toast("Link copied"))
                    .catch(() => toast.error("Couldn't copy the link."));
                }}
              >
                <Link2 />
                Copy link to playlist
              </MenuItem>
            </MenuContent>
          </Menu>

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
                  placeholder="Search in playlist"
                  aria-label="Search in playlist"
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
                <IconButton label="Search in playlist" onClick={() => setFilterOpen(true)}>
                  <Search className="size-[18px]" />
                </IconButton>
              )
            )}
          </div>
        </div>

        {entries.length > 0 && (
          <div className="px-6">
            <TrackTable
              entries={visible}
              canEdit={canEdit}
              showAddedBy={false}
              playingEntryKey={isContext ? currentKey : null}
              isPlaying={playing}
              sortable={!filter.trim()}
              playlistId={playlist.id}
              onPlay={playEntry}
              onTogglePlay={() => usePlayer.getState().togglePlay()}
              onMove={onMove}
              onRemove={onRemove}
            />
            {visible.length === 0 && (
              <p className="text-fg-muted py-10 text-center text-sm">No tracks match &ldquo;{filter}&rdquo;.</p>
            )}
          </div>
        )}

        {canEdit &&
          (entries.length === 0 ? (
            <FindMore playlist={playlist} heading="Let's find something for your playlist" />
          ) : findMore ? (
            <FindMore playlist={playlist} heading="Find more" onClose={() => setFindMore(false)} />
          ) : (
            <div className="flex justify-end px-6 pt-6 pb-12">
              <Button variant="outline" size="sm" onClick={() => setFindMore(true)}>
                Find more
              </Button>
            </div>
          ))}

        {!canEdit && entries.length === 0 && (
          <p className="text-fg-muted px-6 py-12 text-center">This playlist is empty.</p>
        )}
      </div>

      {isOwner && (
        <>
          <EditDetailsDialog open={editing} onOpenChange={setEditing} playlist={playlist} />
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title="Delete this playlist?"
            description={
              <>
                <strong className="text-fg">{playlist.title}</strong> will be deleted for you and anyone you&apos;ve
                shared it with. This can&apos;t be undone.
              </>
            }
            confirmLabel="Delete"
            pending={destroy.isPending}
            onConfirm={() => destroy.mutate({ id: playlist.id })}
          />
        </>
      )}
    </div>
  );
}

function PlaylistSkeleton() {
  return (
    <div>
      <div className="bg-ink-850 flex items-end gap-6 px-6 pt-20 pb-6">
        <div className="skeleton size-[min(232px,22vw)] shrink-0 rounded-md" />
        <div className="flex-1 space-y-4">
          <div className="skeleton h-4 w-20 rounded" />
          <div className="skeleton h-14 w-2/3 rounded" />
          <div className="skeleton h-4 w-1/3 rounded" />
        </div>
      </div>
      <div className="space-y-2 px-6 py-6">
        <div className="skeleton size-14 rounded-full" />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-12 rounded" />
        ))}
      </div>
    </div>
  );
}
