"use client";

import { Check, Link2, LoaderCircle, Lock, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ConnectButton, GrantYouTubeButton } from "~/components/auth/connect-buttons";
import { SpotifyIcon, YouTubeIcon } from "~/components/brand/platform-icons";
import { useImportPlaylist } from "~/components/playlists/use-playlist-actions";
import { Artwork } from "~/components/tracks/artwork";
import { SOURCE_LABEL } from "~/components/tracks/source-badge";
import { Button } from "~/components/ui/button";
import { Tooltip } from "~/components/ui/tooltip";
import { BASE_PATH } from "~/lib/base-path";
import { cn } from "~/lib/cn";
import { plural } from "~/lib/format";
import { type SourceName } from "~/lib/types";
import { api, type RouterOutputs } from "~/trpc/react";

type Library = RouterOutputs["library"]["spotifyPlaylists"];
type Item = Library["playlists"][number];

const SOURCES: SourceName[] = ["SPOTIFY", "YOUTUBE"];

export function ImportView({
  initialSource,
  available,
}: {
  initialSource: SourceName;
  available: Record<SourceName, boolean>;
}) {
  const [source, setSource] = useState<SourceName>(initialSource);

  const select = (next: SourceName) => {
    setSource(next);
    // Keep the tab in the URL (connect flows come back to it) without a server round trip.
    window.history.replaceState(null, "", `?source=${next.toLowerCase()}`);
  };

  return (
    <div className="mx-auto w-full max-w-[880px] px-4 pt-8 pb-16 md:px-6">
      <h1 className="font-display text-[clamp(34px,4vw,48px)] leading-none">Import playlists</h1>
      <p className="text-fg-muted mt-3 max-w-[62ch]">
        Bring your playlists over from Spotify and YouTube, then mix them. An import is a copy: changes made on either
        side afterwards don&apos;t carry over.
      </p>

      <div role="tablist" aria-label="Import from" className="mt-8 flex gap-2">
        {SOURCES.map((s) => {
          const active = s === source;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              id={`import-tab-${s}`}
              aria-selected={active}
              aria-controls="import-panel"
              onClick={() => select(s)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
                active ? "bg-fg text-ink-950" : "text-fg bg-white/[0.07] hover:bg-white/[0.12]",
              )}
            >
              {s === "SPOTIFY" ? (
                <SpotifyIcon className="text-spotify size-4" />
              ) : (
                <YouTubeIcon className="text-youtube size-4" />
              )}
              {SOURCE_LABEL[s]}
            </button>
          );
        })}
      </div>

      <div id="import-panel" role="tabpanel" aria-labelledby={`import-tab-${source}`} className="mt-6">
        {source === "SPOTIFY" ? (
          <SpotifyLibrary available={available.SPOTIFY} />
        ) : (
          <YouTubeLibrary available={available.YOUTUBE} />
        )}
      </div>

      <p className="text-fg-subtle mt-12 flex items-start gap-2.5 text-sm">
        <Link2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Have a link to a Spotify album or a public YouTube playlist? Paste it into{" "}
          <Link href="/search" className="text-fg-muted hover:text-fg underline underline-offset-2">
            search
          </Link>{" "}
          to play it, or save a copy from there.
        </span>
      </p>
    </div>
  );
}

// Separate components so each platform's query only runs while its tab is open.

function SpotifyLibrary({ available }: { available: boolean }) {
  const query = api.library.spotifyPlaylists.useQuery(undefined, {
    enabled: available,
    staleTime: 60_000,
    retry: false,
  });
  return <LibraryPanel source="SPOTIFY" available={available} query={query} />;
}

function YouTubeLibrary({ available }: { available: boolean }) {
  const query = api.library.youtubePlaylists.useQuery(undefined, {
    enabled: available,
    staleTime: 60_000,
    retry: false,
  });
  return <LibraryPanel source="YOUTUBE" available={available} query={query} />;
}

type QueryState = {
  data: Library | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => unknown;
};

function LibraryPanel({ source, available, query }: { source: SourceName; available: boolean; query: QueryState }) {
  const name = SOURCE_LABEL[source];
  const returnTo = `${BASE_PATH}/import?source=${source.toLowerCase()}`;

  if (!available) {
    return (
      <Notice source={source} title={`${name} isn't set up here`} body="This server doesn't have the keys for it." />
    );
  }
  if (query.isLoading) return <RowsSkeleton />;

  const retry = (
    <Button size="sm" variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
      {query.isFetching && <LoaderCircle className="size-3.5 animate-spin" />}
      Try again
    </Button>
  );

  if (query.isError || !query.data) {
    return <Notice source={source} title="Couldn't load your playlists" body="Check your connection." action={retry} />;
  }

  const { status, playlists } = query.data;

  if (status === "not_connected") {
    return source === "SPOTIFY" ? (
      <Notice
        source={source}
        title="Connect Spotify"
        body="See your Spotify playlists here and copy them over. With Premium, connecting also plays full tracks."
        action={
          <ConnectButton provider="spotify" returnTo={returnTo}>
            Connect Spotify
          </ConnectButton>
        }
      />
    ) : (
      <Notice
        source={source}
        title="Connect YouTube"
        body="Sign in with Google and allow read-only access to see your playlists and liked videos."
        action={<GrantYouTubeButton returnTo={returnTo}>Connect YouTube</GrantYouTubeButton>}
      />
    );
  }
  if (status === "needs_access") {
    return (
      <Notice
        source={source}
        title="Allow access to your YouTube library"
        body="Your Google account is only connected for signing in. Read-only access lets Crossfade list your playlists and liked videos; it can't change anything on YouTube."
        action={<GrantYouTubeButton returnTo={returnTo}>Allow access</GrantYouTubeButton>}
      />
    );
  }
  if (status === "expired") {
    return (
      <Notice
        source={source}
        title={`Reconnect ${name}`}
        body={`${name} ended Crossfade's access to your account. Reconnect to see your playlists again.`}
        action={
          source === "SPOTIFY" ? (
            <ConnectButton provider="spotify" returnTo={returnTo}>
              Reconnect
            </ConnectButton>
          ) : (
            <GrantYouTubeButton returnTo={returnTo}>Reconnect</GrantYouTubeButton>
          )
        }
      />
    );
  }
  if (status === "unavailable") {
    return <Notice source={source} title={`${name} didn't answer`} body="Try again in a moment." action={retry} />;
  }
  if (playlists.length === 0) {
    return (
      <Notice
        source={source}
        title="No playlists yet"
        body={`Playlists you make or save on ${name} will show up here.`}
      />
    );
  }

  return <PlaylistList source={source} playlists={playlists} />;
}

function PlaylistList({ source, playlists }: { source: SourceName; playlists: Item[] }) {
  const [filter, setFilter] = useState("");

  const { importable, followed } = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const matching = q
      ? playlists.filter((p) => p.name.toLowerCase().includes(q) || p.owner?.toLowerCase().includes(q))
      : playlists;
    return {
      importable: matching.filter((p) => p.importable),
      followed: matching.filter((p) => !p.importable),
    };
  }, [playlists, filter]);

  const total = playlists.length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-fg-muted text-sm">{plural(total, "playlist")}</p>
        {total > 8 && (
          <div className="bg-ink-800 focus-within:ring-fg/40 flex h-9 w-full items-center gap-2 rounded-md px-3 ring-1 ring-transparent sm:w-64">
            <Search className="text-fg-muted size-4 shrink-0" aria-hidden />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter playlists"
              aria-label="Filter playlists"
              className="placeholder:text-fg-subtle min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            {filter && (
              <button
                type="button"
                aria-label="Clear filter"
                onClick={() => setFilter("")}
                className="text-fg-muted hover:text-fg"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {importable.length > 0 && (
        <ul className="mt-3">
          {importable.map((playlist) => (
            <PlaylistRow key={playlist.id} source={source} playlist={playlist} />
          ))}
        </ul>
      )}

      {followed.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold">Playlists you follow</h2>
          <p className="text-fg-muted mt-1 max-w-[62ch] text-sm">
            Spotify only shares the tracks of playlists you own or collaborate on, so these can&apos;t be copied. To
            bring one over, add its songs to a playlist of your own on Spotify and import that.
          </p>
          <ul className="mt-3">
            {followed.map((playlist) => (
              <PlaylistRow key={playlist.id} source={source} playlist={playlist} />
            ))}
          </ul>
        </section>
      )}

      {importable.length === 0 && followed.length === 0 && (
        <p className="text-fg-muted py-10 text-center text-sm">No playlists match &ldquo;{filter}&rdquo;.</p>
      )}
    </div>
  );
}

function PlaylistRow({ source, playlist }: { source: SourceName; playlist: Item }) {
  const { importPlaylist, pending } = useImportPlaylist();
  const copy = playlist.importedAs ? `/playlist/${playlist.importedAs}` : null;
  const count = plural(playlist.trackCount, source === "SPOTIFY" ? "track" : "video");
  // Your own YouTube playlists are all yours; on Spotify the owner tells followed ones apart.
  const meta = source === "SPOTIFY" && playlist.owner ? `By ${playlist.owner} · ${count}` : count;

  return (
    <li
      className={cn(
        "flex items-center gap-4 rounded-md p-2 transition-colors hover:bg-white/[0.04]",
        !playlist.importable && "opacity-60",
      )}
    >
      <Artwork src={playlist.imageUrl} className="size-14 shrink-0 rounded" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{playlist.name}</p>
        <p className="text-fg-muted flex min-w-0 items-center gap-1.5 text-sm">
          <span className="truncate">{meta}</span>
          {copy && (
            <Link href={copy} className="text-accent inline-flex shrink-0 items-center gap-1 hover:underline">
              <Check className="size-3.5" aria-hidden />
              Imported
            </Link>
          )}
        </p>
      </div>
      {playlist.importable ? (
        <div className="flex shrink-0 items-center gap-1">
          {copy && (
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href={copy}>Open copy</Link>
            </Button>
          )}
          <Button
            size="sm"
            variant={copy ? "outline" : "light"}
            disabled={pending || playlist.trackCount === 0}
            onClick={() => void importPlaylist({ source, kind: "playlist", id: playlist.id })}
          >
            {pending && <LoaderCircle className="size-3.5 animate-spin" />}
            {copy ? "Import again" : "Import"}
          </Button>
        </div>
      ) : (
        <Tooltip label="Spotify doesn't share playlists you only follow">
          <span className="text-fg-subtle grid size-8 shrink-0 place-items-center" aria-label="Can't be imported">
            <Lock className="size-4" />
          </span>
        </Tooltip>
      )}
    </li>
  );
}

function Notice({
  source,
  title,
  body,
  action,
}: {
  source: SourceName;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-ink-850 flex flex-col items-start gap-4 rounded-xl p-5 sm:flex-row sm:items-center sm:p-6">
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-black/35">
        {source === "SPOTIFY" ? (
          <SpotifyIcon className="text-spotify size-6" />
        ) : (
          <YouTubeIcon className="text-youtube size-6" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-fg-muted mt-0.5 text-sm leading-snug">{body}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="mt-9">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 p-2">
          <div className="skeleton size-14 rounded" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-1/2 rounded" />
            <div className="skeleton h-3 w-1/3 rounded" />
          </div>
          <div className="skeleton h-8 w-[72px] rounded-full" />
        </div>
      ))}
    </div>
  );
}
