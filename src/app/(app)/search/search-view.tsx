"use client";

import { keepPreviousData } from "@tanstack/react-query";
import {
  CircleAlert,
  CircleCheck,
  CirclePlus,
  Clock3,
  Link2,
  LoaderCircle,
  Pause,
  Play,
  Shuffle,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useTrackStatus } from "~/components/player/track-status";
import { useImportPlaylist } from "~/components/playlists/use-playlist-actions";
import { useViewer } from "~/components/providers/viewer-provider";
import { Artwork } from "~/components/tracks/artwork";
import { SourceBadge, SOURCE_LABEL } from "~/components/tracks/source-badge";
import { TrackRow, TrackRowSkeleton } from "~/components/tracks/track-row";
import { IconButton } from "~/components/ui/button";
import { PlayButton } from "~/components/ui/play-button";
import { cn } from "~/lib/cn";
import { formatLongDuration, plural } from "~/lib/format";
import { usePlayer } from "~/lib/player/store";
import { type PlayContext } from "~/lib/player/types";
import { interleave, type SearchResult } from "~/lib/search-results";
import { type ProviderStatus, type SourceName, type TrackData, trackKey } from "~/lib/types";
import { useTapToPlay } from "~/lib/use-tap-to-play";
import { VIBES } from "~/lib/vibes";
import { api } from "~/trpc/react";

type LinkData = Extract<SearchResult, { isLink: true }>["link"];
type CollectionData = Extract<LinkData, { kind: "collection" }>;

type Filter = "all" | SourceName;

const RECENTS_KEY = "crossfade:recent-searches";

function readRecents(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeRecents(list: string[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {
    // storage full or blocked; recents are a nicety
  }
}

export function SearchView() {
  const q = useSearchParams().get("q")?.trim() ?? "";
  const [filter, setFilter] = useState<Filter>("all");
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => setRecents(readRecents()), []);
  useEffect(() => setFilter("all"), [q]);

  const search = api.search.tracks.useQuery(
    { q },
    {
      enabled: q.length > 0,
      placeholderData: keepPreviousData,
      staleTime: 5 * 60_000,
      retry: false,
    },
  );

  useEffect(() => {
    if (!q || search.data?.query !== q || search.data.isLink) return;
    const next = [q, ...readRecents().filter((r) => r.toLowerCase() !== q.toLowerCase())];
    writeRecents(next);
    setRecents(next.slice(0, 10));
  }, [q, search.data]);

  if (!q) {
    return (
      <Browse
        recents={recents}
        onClearRecents={() => {
          writeRecents([]);
          setRecents([]);
        }}
      />
    );
  }

  return (
    <div className="px-4 pt-4 pb-10 md:px-6">
      <Results
        q={q}
        filter={filter}
        onFilter={setFilter}
        data={search.data}
        isFetching={search.isFetching}
        error={search.error?.message ?? null}
      />
    </div>
  );
}

function Results({
  q,
  filter,
  onFilter,
  data,
  isFetching,
  error,
}: {
  q: string;
  filter: Filter;
  onFilter: (f: Filter) => void;
  data: SearchResult | undefined;
  isFetching: boolean;
  error: string | null;
}) {
  const stale = isFetching && data?.query !== q;
  const spotifyFirst = useViewer()?.connections.spotifyPlayback ?? false;

  const providers = useMemo(() => {
    if (!data || data.isLink) return [];
    const list = [
      {
        source: "SPOTIFY" as const,
        status: data.spotify.status,
        tracks: data.spotify.tracks,
      },
      {
        source: "YOUTUBE" as const,
        status: data.youtube.status,
        tracks: data.youtube.tracks,
      },
    ];
    // Whoever can play Spotify in full gets it first; everyone else would only hear previews.
    return spotifyFirst ? list : list.reverse();
  }, [data, spotifyFirst]);

  if (error) {
    return <EmptyState title="Search isn't working right now" body={error} />;
  }

  if (!data) return <ResultsSkeleton />;

  if (data.isLink) {
    return (
      <div className={cn("transition-opacity", stale && "opacity-50")}>
        <LinkView link={data.link} />
      </div>
    );
  }

  // Platforms that aren't set up on this server don't get a filter chip.
  const shown = providers.filter((p) => p.status !== "disabled" || p.tracks.length > 0);
  const merged = interleave(providers.map((p) => p.tracks));
  const visible = filter === "all" ? merged : (providers.find((p) => p.source === filter)?.tracks ?? []);
  const top = visible[0];
  const context: PlayContext = {
    type: "search",
    title: `Search: ${q}`,
    href: `/search?q=${encodeURIComponent(q)}`,
  };
  const playFrom = (index: number) => usePlayer.getState().playTracks(visible, index, context);
  const anyAnswered = providers.some((p) => p.status === "ok");

  return (
    <div className={cn("transition-opacity duration-150", stale && "opacity-50")}>
      {shown.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter results by platform">
          {(["all", ...shown.map((p) => p.source)] as Filter[]).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => onFilter(f)}
              className={cn(
                "h-8 rounded-full px-3.5 text-sm font-medium transition-colors",
                filter === f ? "bg-fg text-ink-950" : "text-fg bg-white/[0.07] hover:bg-white/[0.12]",
              )}
            >
              {f === "all" ? "All" : SOURCE_LABEL[f]}
            </button>
          ))}
        </div>
      )}

      <ProviderNotes providers={providers} />

      {visible.length === 0 ? (
        anyAnswered || filter !== "all" ? (
          <EmptyState
            title={`No results for “${q}”`}
            body="Check the spelling, try fewer words, or paste a link to the exact video or track."
          />
        ) : null
      ) : (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            {top && (
              <section>
                <h2 className="mb-3 text-2xl font-bold">Top result</h2>
                <TopResult track={top} onPlay={() => playFrom(0)} />
              </section>
            )}
            <section className="min-w-0">
              <h2 className="mb-2 text-2xl font-bold">Tracks</h2>
              <div>
                {visible.slice(1, 5).map((track, i) => (
                  <TrackRow key={trackKey(track)} track={track} onPlay={() => playFrom(i + 1)} menu={{}} />
                ))}
              </div>
            </section>
          </div>

          {visible.length > 5 && (
            <section className="mt-8">
              <h2 className="mb-2 text-2xl font-bold">More results</h2>
              <div className="grid gap-x-6 xl:grid-cols-2">
                {visible.slice(5).map((track, i) => (
                  <TrackRow key={trackKey(track)} track={track} onPlay={() => playFrom(i + 5)} menu={{}} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// --- Pasted links -------------------------------------------------------------------------------

function LinkView({ link }: { link: LinkData }) {
  if (link.kind === "collection") return <CollectionResult collection={link} />;

  return (
    <section className="max-w-3xl">
      <h2 className="flex items-center gap-2 text-2xl font-bold">
        <Link2 className="text-fg-muted size-5" /> From your link
      </h2>
      {link.kind === "track" ? (
        <div className="mt-4">
          <TopResult
            track={link.track}
            onPlay={() =>
              usePlayer.getState().playTracks([link.track], 0, {
                type: "link",
                title: "Your link",
              })
            }
          />
        </div>
      ) : (
        <p className="bg-ink-850 text-fg-muted mt-4 flex items-start gap-3 rounded-lg px-4 py-3.5">
          <CircleAlert className="text-fg-subtle mt-0.5 size-5 shrink-0" />
          <span>{link.message}</span>
        </p>
      )}
    </section>
  );
}

/** An album or playlist from a pasted link, laid out like a playlist page. */
function CollectionResult({ collection }: { collection: CollectionData }) {
  const viewer = useViewer();
  const contextId = `${collection.source}:${collection.type}:${collection.id}`;
  const isContext = usePlayer((s) => s.context?.type === "link" && s.context.id === contextId);
  const playing = usePlayer((s) => s.status === "playing" || s.status === "loading") && isContext;
  const { tracks } = collection;
  const total = tracks.reduce((sum, t) => sum + t.durationMs, 0);
  const context: PlayContext = {
    type: "link",
    id: contextId,
    title: collection.title,
  };

  const play = (index: number, { shuffle = false } = {}) => {
    const player = usePlayer.getState();
    if (shuffle !== player.shuffle) player.toggleShuffle();
    player.playTracks(tracks, index, context);
  };

  return (
    <section>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <Artwork
          src={collection.artworkUrl}
          eager
          className="size-[min(192px,40vw)] shrink-0 rounded-md shadow-[var(--shadow-art)]"
        />
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            <SourceBadge source={collection.source} withLabel={false} />
            {collection.type === "album" ? "Album" : "Playlist"} on {SOURCE_LABEL[collection.source]}
          </p>
          <h2 className="mt-2 line-clamp-2 text-[clamp(28px,4vw,56px)] leading-[1.02] font-extrabold tracking-tight">
            {collection.title}
          </h2>
          <p className="text-fg-muted mt-3 text-sm">
            {[collection.subtitle, plural(tracks.length, "track"), total > 0 ? formatLongDuration(total) : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <PlayButton
          playing={playing}
          label={collection.title}
          disabled={tracks.length === 0}
          onClick={() => (isContext ? usePlayer.getState().togglePlay() : play(0))}
        />
        <IconButton
          label="Shuffle play"
          size="lg"
          disabled={tracks.length === 0}
          onClick={() => play(0, { shuffle: true })}
        >
          <Shuffle className="size-6" />
        </IconButton>
        {viewer && <SaveCollection collection={collection} />}
      </div>

      {collection.skipped > 0 && (
        <p className="text-fg-subtle mt-4 text-sm">
          {plural(collection.skipped, "item")} left out: local files, podcasts, or tracks that can&apos;t play here.
        </p>
      )}

      <div className="mt-4 max-w-4xl">
        {tracks.map((track, i) => (
          <TrackRow key={`${trackKey(track)}:${i}`} track={track} onPlay={() => play(i)} menu={{}} />
        ))}
      </div>
    </section>
  );
}

/** Saves the album or playlist as a Crossfade playlist; afterwards, opens the copy. */
function SaveCollection({ collection }: { collection: CollectionData }) {
  const router = useRouter();
  const { importPlaylist, pending } = useImportPlaylist();
  const [savedAs, setSavedAs] = useState<string | null>(null);

  if (savedAs) {
    return (
      <IconButton label="Saved. Open your copy" size="lg" active onClick={() => router.push(`/playlist/${savedAs}`)}>
        <CircleCheck className="size-7" />
      </IconButton>
    );
  }
  const save = async () => {
    const saved = await importPlaylist({ source: collection.source, kind: collection.type, id: collection.id });
    if (saved) setSavedAs(saved.id);
  };
  return (
    <IconButton
      label="Save as a playlist"
      size="lg"
      disabled={pending || collection.tracks.length === 0}
      onClick={() => void save()}
    >
      {pending ? <LoaderCircle className="size-6 animate-spin" /> : <CirclePlus className="size-7" />}
    </IconButton>
  );
}

const NOTES: Record<SourceName, Partial<Record<ProviderStatus, string>>> = {
  YOUTUBE: {
    disabled: "YouTube search isn't set up on this server. You can still paste a YouTube link.",
    quota:
      "YouTube searches are paused until midnight Pacific to stay inside the daily API quota. Pasting a YouTube link still works.",
    unavailable: "YouTube didn't answer this time. Try again in a moment.",
  },
  SPOTIFY: {
    quota: "Spotify asked us to slow down. Its results will be back in a minute.",
    unavailable: "Spotify didn't answer this time. Try again in a moment.",
  },
};

function ProviderNotes({ providers }: { providers: { source: SourceName; status: ProviderStatus }[] }) {
  const notes = providers
    .map((p) => ({ source: p.source, text: NOTES[p.source][p.status] }))
    .filter((n): n is { source: SourceName; text: string } => Boolean(n.text));
  if (notes.length === 0) return null;
  return (
    <div className="mt-4 space-y-2">
      {notes.map((note) => (
        <p key={note.source} className="bg-ink-850 text-fg-muted flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm">
          <SourceBadge source={note.source} withLabel={false} className="mt-0.5" />
          {note.text}
        </p>
      ))}
    </div>
  );
}

function TopResult({ track, onPlay }: { track: TrackData; onPlay: () => void }) {
  const status = useTrackStatus(track);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const tap = useTapToPlay(status ? togglePlay : onPlay);
  return (
    <div
      onDoubleClick={onPlay}
      onClick={tap}
      className="group bg-ink-850 hover:bg-ink-800 relative rounded-lg p-5 transition-colors"
    >
      <Artwork src={track.artworkUrl} className="size-[92px] rounded-md shadow-[var(--shadow-art)]" eager />
      <p
        className={cn(
          "mt-5 line-clamp-2 pr-14 text-[28px] leading-tight font-bold tracking-tight",
          status && "text-accent",
        )}
      >
        {track.title}
      </p>
      <p className="text-fg-muted mt-2 flex items-center gap-2 text-sm">
        <SourceBadge
          source={track.source}
          className="text-fg rounded-full bg-black/30 px-2 py-0.5 text-xs font-medium"
        />
        <span className="truncate">{track.artist}</span>
      </p>
      <button
        type="button"
        onClick={status ? togglePlay : onPlay}
        aria-label={status === "playing" ? `Pause ${track.title}` : `Play ${track.title}`}
        className={cn(
          "bg-accent text-accent-ink hover:bg-accent-hover absolute right-5 bottom-5 grid size-12 place-items-center rounded-full shadow-[0_8px_24px_rgb(0_0_0/0.45)] transition-all duration-200 hover:scale-105",
          status === "playing"
            ? "translate-y-0 opacity-100"
            : "translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100",
        )}
      >
        {status === "playing" ? (
          <Pause className="size-5 fill-current" />
        ) : (
          <Play className="ml-0.5 size-5 fill-current" />
        )}
      </button>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div>
      <div className="flex gap-2">
        {[48, 72, 76].map((w) => (
          <div key={w} className="skeleton h-8 rounded-full" style={{ width: w }} />
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="skeleton h-[236px] rounded-lg" />
        <div>
          {Array.from({ length: 4 }, (_, i) => (
            <TrackRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="text-xl font-bold">{title}</p>
      <p className="text-fg-muted mt-2">{body}</p>
    </div>
  );
}

// --- Browse (empty search) ------------------------------------------------------------------------

function Browse({ recents, onClearRecents }: { recents: string[]; onClearRecents: () => void }) {
  return (
    <div className="px-4 pt-6 pb-10 md:px-6">
      {recents.length > 0 && (
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Recent searches</h2>
            <button
              type="button"
              onClick={onClearRecents}
              className="text-fg-muted hover:text-fg inline-flex items-center gap-1.5 text-sm"
            >
              <X className="size-4" /> Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recents.map((r) => (
              <Link
                key={r}
                href={`/search?q=${encodeURIComponent(r)}`}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-white/[0.07] px-4 text-sm transition-colors hover:bg-white/[0.12]"
              >
                <Clock3 className="text-fg-muted size-3.5" />
                {r}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-2xl font-bold">Start with a vibe</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {VIBES.map((v) => (
            <Link
              key={v.label}
              href={`/search?q=${encodeURIComponent(v.q)}`}
              className="group relative aspect-[16/10] overflow-hidden rounded-lg p-4"
              style={{ backgroundColor: v.color }}
            >
              <span className="font-display relative z-10 text-[clamp(17px,1.6vw,22px)] leading-none">{v.label}</span>
              <svg
                viewBox="0 0 100 60"
                aria-hidden
                className="absolute -right-3 -bottom-3 w-2/3 opacity-30 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3"
              >
                <path d="M0 12c26 0 40 40 100 40" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" />
                <path
                  d="M0 52c26 0 40-40 100-40"
                  fill="none"
                  stroke="white"
                  strokeWidth="6"
                  strokeLinecap="round"
                  opacity=".5"
                />
              </svg>
            </Link>
          ))}
        </div>
        <p className="text-fg-subtle mt-6 text-sm">
          Tip: paste a YouTube or Spotify link into the search bar to jump straight to it.
        </p>
      </section>
    </div>
  );
}
