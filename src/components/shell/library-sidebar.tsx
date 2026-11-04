"use client";

import { Import, LibraryBig, ListMusic, Plus, Search, Volume2, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { PlaylistCover } from "~/components/playlists/playlist-cover";
import { LikedCover, useLikedKeys } from "~/components/tracks/likes";
import { useCreatePlaylist } from "~/components/playlists/use-playlist-actions";
import { useViewer } from "~/components/providers/viewer-provider";
import { Button, IconButton } from "~/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "~/components/ui/menu";
import { cn } from "~/lib/cn";
import { plural } from "~/lib/format";
import { usePlayer } from "~/lib/player/store";
import { useSignInHref } from "~/lib/sign-in";
import { api } from "~/trpc/react";

export function LibrarySidebar() {
  const viewer = useViewer();
  const { createPlaylist, pending } = useCreatePlaylist();

  return (
    <aside
      aria-label="Your library"
      className="bg-ink-900 hidden w-[284px] shrink-0 flex-col overflow-hidden rounded-[var(--radius-panel)] md:flex lg:w-[304px]"
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-fg flex items-center gap-2.5 text-[15px] font-semibold">
          <LibraryBig className="text-fg-muted size-5" aria-hidden />
          Your library
        </h2>
        {viewer && (
          <Menu>
            <MenuTrigger asChild>
              <IconButton label="Create or import a playlist" size="sm" tooltip={false} disabled={pending}>
                <Plus className="size-5" />
              </IconButton>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem onSelect={() => void createPlaylist()}>
                <ListMusic />
                New playlist
              </MenuItem>
              <MenuItem asChild>
                <Link href="/import">
                  <Import />
                  Import from Spotify or YouTube
                </Link>
              </MenuItem>
            </MenuContent>
          </Menu>
        )}
      </div>
      {viewer ? <PlaylistList onCreate={() => void createPlaylist()} creating={pending} /> : <GuestLibrary />}
    </aside>
  );
}

function GuestLibrary() {
  const signInHref = useSignInHref();
  return (
    <div className="scroll-area flex-1 px-2 pb-2">
      <div className="bg-ink-850 m-2 rounded-lg p-4">
        <p className="text-[15px] font-semibold">Make a playlist that mixes both</p>
        <p className="text-fg-muted mt-1 text-sm">
          Spotify tracks and YouTube videos can sit in the same list. Sign in to start one.
        </p>
        <Button asChild size="sm" className="mt-4">
          <Link href={signInHref}>Sign in</Link>
        </Button>
      </div>
    </div>
  );
}

function PlaylistList({ onCreate, creating }: { onCreate: () => void; creating: boolean }) {
  const library = api.playlist.library.useQuery(undefined, { staleTime: 30_000 });
  const pathname = usePathname();
  const liked = useLikedKeys();
  const playingFrom = usePlayer((s) =>
    s.context?.type === "playlist" ? s.context.id : s.context?.type === "liked" ? "liked" : null,
  );
  const playing = usePlayer((s) => s.status === "playing" || s.status === "loading");
  const [filter, setFilter] = useState("");
  const [filtering, setFiltering] = useState(false);

  const playlists = useMemo(() => {
    const all = library.data ?? [];
    const q = filter.trim().toLowerCase();
    return q ? all.filter((p) => p.title.toLowerCase().includes(q)) : all;
  }, [library.data, filter]);

  if (library.isLoading) {
    return (
      <div className="flex-1 space-y-1 px-2 pt-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <div className="skeleton size-12 rounded-md" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3.5 w-3/4 rounded" />
              <div className="skeleton h-3 w-1/2 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if ((library.data ?? []).length === 0 && liked.size === 0) {
    return (
      <div className="scroll-area flex-1 px-2 pb-2">
        <div className="bg-ink-850 m-2 rounded-lg p-4">
          <p className="text-[15px] font-semibold">Create your first playlist</p>
          <p className="text-fg-muted mt-1 text-sm">
            Mix Spotify tracks and YouTube videos. Crossfade plays them straight through.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={onCreate} disabled={creating}>
              Create playlist
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/import">Import</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-9 items-center gap-1 px-3">
        {filtering ? (
          <div className="bg-ink-800 animate-fade-in flex h-8 flex-1 items-center gap-2 rounded-md px-2">
            <Search className="text-fg-muted size-4 shrink-0" aria-hidden />
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setFilter("");
                  setFiltering(false);
                }
              }}
              placeholder="Search in your library"
              aria-label="Search in your library"
              className="text-fg placeholder:text-fg-subtle min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
            <button
              type="button"
              aria-label="Close library search"
              onClick={() => {
                setFilter("");
                setFiltering(false);
              }}
              className="text-fg-muted hover:text-fg"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <IconButton label="Search in your library" size="sm" onClick={() => setFiltering(true)}>
            <Search className="size-4" />
          </IconButton>
        )}
      </div>
      <nav aria-label="Playlists" className="scroll-area flex-1 px-2 pb-2">
        <ul>
          {!filter.trim() && (
            <li>
              <Link
                href="/liked"
                aria-current={pathname === "/liked" ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-md p-2 transition-colors",
                  pathname === "/liked" ? "bg-white/[0.08] hover:bg-white/[0.11]" : "hover:bg-white/[0.05]",
                )}
              >
                <LikedCover className="size-12 rounded-md" />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-[15px] leading-5",
                      playingFrom === "liked" ? "text-accent" : "text-fg",
                    )}
                  >
                    Liked Songs
                  </p>
                  <p className="text-fg-muted truncate text-[13px] leading-5">
                    Playlist · {plural(liked.size, "song")}
                  </p>
                </div>
                {playingFrom === "liked" && playing && (
                  <Volume2 className="text-accent size-4 shrink-0" aria-label="Playing" />
                )}
              </Link>
            </li>
          )}
          {playlists.map((playlist) => {
            const href = `/playlist/${playlist.id}`;
            const active = pathname === href;
            const isPlaying = playingFrom === playlist.id;
            return (
              <li key={playlist.id}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-md p-2 transition-colors",
                    active ? "bg-white/[0.08] hover:bg-white/[0.11]" : "hover:bg-white/[0.05]",
                  )}
                >
                  <PlaylistCover covers={playlist.covers} className="size-12 rounded-md" />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-[15px] leading-5", isPlaying ? "text-accent" : "text-fg")}>
                      {playlist.title}
                    </p>
                    <p className="text-fg-muted truncate text-[13px] leading-5">
                      {playlist.role === "editor"
                        ? `Collaborative · ${playlist.ownerName}`
                        : `${playlist.collaborative ? "Collaborative" : "Playlist"} · ${plural(playlist.trackCount, "track")}`}
                    </p>
                  </div>
                  {isPlaying && playing && <Volume2 className="text-accent size-4 shrink-0" aria-label="Playing" />}
                </Link>
              </li>
            );
          })}
        </ul>
        {playlists.length === 0 && (
          <p className="text-fg-muted px-3 py-6 text-center text-sm">No playlists match &ldquo;{filter}&rdquo;.</p>
        )}
      </nav>
    </>
  );
}
