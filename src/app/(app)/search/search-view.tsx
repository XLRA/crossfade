"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { Clock3, Link2, Pause, Play, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Artwork } from "~/components/tracks/artwork";
import { SourceBadge } from "~/components/tracks/source-badge";
import { useTrackStatus } from "~/components/player/track-status";
import { TrackRow, TrackRowSkeleton } from "~/components/tracks/track-row";
import { cn } from "~/lib/cn";
import { usePlayer } from "~/lib/player/store";
import { type PlayContext } from "~/lib/player/types";
import { type ProviderStatus, type SourceName, type TrackData, trackKey } from "~/lib/types";
import { interleave, type SearchResult } from "~/lib/search-results";
import { api } from "~/trpc/react";

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

  const providers = useMemo(() => {
    if (!data || data.isLink) return [];
    return [{ source: "YOUTUBE" as const, status: data.youtube.status, tracks: data.youtube.tracks }];
  }, [data]);

  if (error) {
    return <EmptyState title="Search isn't working right now" body={error} />;
  }

  if (!data) return <ResultsSkeleton />;

  if (data.isLink) {
    return (
      <section className={cn("max-w-3xl transition-opacity", stale && "opacity-50")}>
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <Link2 className="text-fg-muted size-5" /> From your link
        </h2>
        {data.link ? (
          <div className="mt-4">
            <TopResult
              track={data.link}
              onPlay={() => usePlayer.getState().playTracks([data.link!], 0, { type: "link", title: "Your link" })}
            />
          </div>
        ) : (
          <p className="text-fg-muted mt-3">
            That link doesn&apos;t point to a track or video we can play. Playlists and albums can be brought in from
            the import page.
          </p>
        )}
      </section>
    );
  }

  const available = providers.filter((p) => p.tracks.length > 0);
  const merged = interleave(providers.map((p) => p.tracks));
  const visible = filter === "all" ? merged : (providers.find((p) => p.source === filter)?.tracks ?? []);
  const top = visible[0];
  const context: PlayContext = {
    type: "search",
    title: `Search: ${q}`,
    href: `/search?q=${encodeURIComponent(q)}`,
  };
  const playFrom = (index: number) => usePlayer.getState().playTracks(visible, index, context);

  return (
    <div className={cn("transition-opacity duration-150", stale && "opacity-50")}>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter results by platform">
        {(["all", ...providers.map((p) => p.source)] as Filter[]).map((f) => (
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
            {f === "all" ? "All" : f === "SPOTIFY" ? "Spotify" : "YouTube"}
          </button>
        ))}
      </div>

      <ProviderNotes providers={providers} />

      {visible.length === 0 ? (
        available.length === 0 && providers.every((p) => p.status !== "ok") ? null : (
          <EmptyState
            title={`No results for “${q}”`}
            body="Check the spelling, try fewer words, or paste a link to the exact video or track."
          />
        )
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

const NOTES: Record<SourceName, Partial<Record<ProviderStatus, string>>> = {
  YOUTUBE: {
    disabled: "YouTube search isn't set up on this server. You can still paste a YouTube link.",
    quota:
      "YouTube searches are paused until midnight Pacific to stay inside the daily API quota. Pasting a YouTube link still works.",
    unavailable: "YouTube didn't answer this time. Try again in a moment.",
  },
  SPOTIFY: {
    disabled: "Spotify search isn't set up on this server.",
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
  return (
    <div onDoubleClick={onPlay} className="group bg-ink-850 hover:bg-ink-800 relative rounded-lg p-5 transition-colors">
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

const VIBES = [
  { label: "Live sessions", q: "live session", color: "#6b3a2a" },
  { label: "Tiny Desk", q: "tiny desk concert", color: "#2f4858" },
  { label: "Lo-fi", q: "lofi hip hop", color: "#4a3b63" },
  { label: "Acoustic covers", q: "acoustic cover", color: "#3f5a36" },
  { label: "90s R&B", q: "90s r&b", color: "#6a2c47" },
  { label: "Synthwave", q: "synthwave", color: "#26406b" },
  { label: "Jazz standards", q: "jazz standards", color: "#5e4b1f" },
  { label: "Bedroom pop", q: "bedroom pop", color: "#2e5552" },
];

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
