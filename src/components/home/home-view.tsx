"use client";

import { Import, ListMusic, Search } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { TrackCard, QuickTile, VideoCard } from "~/components/home/cards";
import { Shelf, SHELF_ITEM, SHELF_WIDE_ITEM } from "~/components/home/shelf";
import { PlaylistCard } from "~/components/playlists/playlist-card";
import { PlaylistCover } from "~/components/playlists/playlist-cover";
import { useCreatePlaylist } from "~/components/playlists/use-playlist-actions";
import { LikedCover } from "~/components/tracks/likes";
import { Button } from "~/components/ui/button";
import { plural } from "~/lib/format";
import { usePlayer } from "~/lib/player/store";
import { type PlayContext } from "~/lib/player/types";
import { type TrackData, trackKey } from "~/lib/types";
import { api, type RouterOutputs } from "~/trpc/react";

type Feed = RouterOutputs["home"]["feed"];

function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

const noop = () => () => undefined;

/** The greeting depends on the listener's clock, so it only renders in the browser. */
function useGreeting(): string | null {
  return useSyncExternalStore(
    noop,
    () => greetingFor(new Date().getHours()),
    () => null,
  );
}

function playShelf(tracks: TrackData[], index: number, title: string) {
  const context: PlayContext = { type: "home", title, href: "/" };
  usePlayer.getState().playTracks(tracks, index, context);
}

export function HomeView() {
  const feed = api.home.feed.useQuery(undefined, { staleTime: 60_000 });
  const greeting = useGreeting();

  return (
    <div className="@container relative min-h-full">
      {/* A warm wash behind the greeting, fading into the page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(120%_100%_at_0%_0%,rgb(255_197_61/0.16),transparent_60%)]"
      />
      <div className="relative px-4 pt-6 pb-16 md:px-6">
        <h1 className="font-display min-h-[1.2em] text-[clamp(26px,4.2cqi,40px)] leading-tight">
          {greeting && <span className="animate-fade-in">{greeting}</span>}
        </h1>
        {feed.data ? <Shelves feed={feed.data} /> : <HomeSkeleton />}
      </div>
    </div>
  );
}

function Shelves({ feed }: { feed: Feed }) {
  const { recent, jumpBackIn, playlists, likedCount, community, trending } = feed;
  const fresh = recent.length === 0 && playlists.length === 0 && likedCount === 0;

  // Quick access: Liked Songs, then what was played lately, then the rest of the library.
  const tiles = [...jumpBackIn, ...playlists].filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i);

  return (
    <>
      {!fresh && (
        <div className="mt-5 grid grid-cols-2 gap-2 @3xl:grid-cols-4 @3xl:gap-3">
          {likedCount > 0 && (
            <QuickTile id="liked" href="/liked" title="Liked Songs" cover={<LikedCover className="size-full" />} />
          )}
          {tiles.slice(0, likedCount > 0 ? 7 : 8).map((p) => (
            <QuickTile
              key={p.id}
              id={p.id}
              href={`/playlist/${p.id}`}
              title={p.title}
              cover={<PlaylistCover covers={p.covers} className="size-full" />}
            />
          ))}
        </div>
      )}

      {fresh && <GetStarted />}

      {jumpBackIn.length > 0 && (
        <Shelf title="Jump back in">
          {jumpBackIn.map((p) => (
            <PlaylistCard
              key={p.id}
              playlist={{ id: p.id, title: p.title, covers: p.covers, subtitle: `By ${p.ownerName}` }}
              className={SHELF_ITEM}
            />
          ))}
        </Shelf>
      )}

      {recent.length > 0 && (
        <Shelf title="Recently played">
          {recent.map((track, i) => (
            <TrackCard
              key={trackKey(track)}
              track={track}
              onPlay={() => playShelf(recent, i, "Recently played")}
              className={SHELF_ITEM}
            />
          ))}
        </Shelf>
      )}

      {playlists.length > 0 && (
        <Shelf title="Your playlists">
          {playlists.map((p) => (
            <PlaylistCard
              key={p.id}
              playlist={{ id: p.id, title: p.title, covers: p.covers, subtitle: plural(p.trackCount, "track") }}
              className={SHELF_ITEM}
            />
          ))}
        </Shelf>
      )}

      <CommunityShelf playlists={community} />
      <TrendingShelf tracks={trending} />
    </>
  );
}

export function CommunityShelf({ playlists }: { playlists: Feed["community"] }) {
  if (playlists.length === 0) return null;
  return (
    <Shelf title="Public playlists" subtitle="Made by other listeners">
      {playlists.map((p) => (
        <PlaylistCard
          key={p.id}
          playlist={{ id: p.id, title: p.title, covers: p.covers, subtitle: `By ${p.ownerName}` }}
          className={SHELF_ITEM}
        />
      ))}
    </Shelf>
  );
}

export function TrendingShelf({ tracks }: { tracks: TrackData[] }) {
  if (tracks.length === 0) return null;
  return (
    <Shelf title="Trending music videos" subtitle="Most watched on YouTube right now">
      {tracks.map((track, i) => (
        <VideoCard
          key={trackKey(track)}
          track={track}
          onPlay={() => playShelf(tracks, i, "Trending music videos")}
          className={SHELF_WIDE_ITEM}
        />
      ))}
    </Shelf>
  );
}

function GetStarted() {
  const { createPlaylist, pending } = useCreatePlaylist();
  const steps = [
    {
      icon: Search,
      title: "Search both at once",
      body: "Every result says where it streams from: the studio cut on Spotify, the live take on YouTube.",
      action: (
        <Button asChild size="sm">
          <Link href="/search">Search</Link>
        </Button>
      ),
    },
    {
      icon: ListMusic,
      title: "Mix them in one playlist",
      body: "Add tracks from either platform. Crossfade switches players and blends one into the next.",
      action: (
        <Button size="sm" onClick={() => void createPlaylist()} disabled={pending}>
          New playlist
        </Button>
      ),
    },
    {
      icon: Import,
      title: "Bring your playlists",
      body: "Copy playlists over from your Spotify or YouTube account, then mix them.",
      action: (
        <Button asChild size="sm" variant="outline">
          <Link href="/import">Import</Link>
        </Button>
      ),
    },
  ];

  return (
    <section className="mt-6">
      <p className="text-fg-muted max-w-[60ch]">Nothing played yet. Three ways to start:</p>
      <ol className="mt-4 grid gap-3 @3xl:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="bg-ink-850 flex flex-col rounded-xl p-5">
            <div className="flex items-center gap-3">
              <span className="bg-accent text-accent-ink grid size-8 place-items-center rounded-full text-sm font-bold">
                {i + 1}
              </span>
              <step.icon className="text-fg-muted size-5" aria-hidden />
            </div>
            <p className="mt-4 text-lg font-bold">{step.title}</p>
            <p className="text-fg-muted mt-1 flex-1 text-sm leading-relaxed">{step.body}</p>
            <div className="mt-5">{step.action}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <div aria-hidden>
      <div className="mt-5 grid grid-cols-2 gap-2 @3xl:grid-cols-4 @3xl:gap-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="skeleton h-14 rounded-md @3xl:h-16" />
        ))}
      </div>
      <div className="skeleton mt-10 h-7 w-48 rounded" />
      <div className="mt-3 flex gap-6 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="w-[clamp(150px,19cqi,204px)] shrink-0">
            <div className="skeleton aspect-square w-full rounded-md" />
            <div className="skeleton mt-3 h-4 w-3/4 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
