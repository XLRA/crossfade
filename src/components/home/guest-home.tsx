"use client";

import { Search } from "lucide-react";
import Link from "next/link";

import { CommunityShelf, TrendingShelf } from "~/components/home/home-view";
import { Button } from "~/components/ui/button";
import { useSignInHref } from "~/lib/sign-in";
import { VIBES } from "~/lib/vibes";
import { api } from "~/trpc/react";

/**
 * The home page before signing in: what Crossfade does, a way straight into search, and things
 * anyone can play. `art` is the waveform illustration, rendered on the server.
 */
export function GuestHome({ art }: { art: React.ReactNode }) {
  const feed = api.home.feed.useQuery(undefined, { staleTime: 60_000 });
  const signInHref = useSignInHref();

  return (
    <div className="@container min-h-full px-4 pt-4 pb-16 md:px-6">
      <section className="bg-ink-850 relative isolate overflow-hidden rounded-xl">
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 -z-10 w-full [mask-image:linear-gradient(90deg,transparent_5%,black_60%)] opacity-70 @3xl:w-[72%] @3xl:opacity-100"
        >
          {art}
        </div>
        <div className="max-w-[600px] px-6 py-9 @3xl:px-10 @3xl:py-12">
          <p className="eyebrow text-accent">Spotify + YouTube</p>
          <h1 className="font-display mt-3 text-[clamp(34px,6.2cqi,60px)] leading-[0.95]">
            One search.
            <br />
            One queue.
            <br />
            Both libraries.
          </h1>
          <p className="text-fg-muted mt-5 max-w-[46ch] text-[15px] leading-relaxed">
            The studio cut on Spotify and the live take on YouTube show up in the same results, and play back to back.
            Listening doesn&rsquo;t need an account; playlists do.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild variant="accent" size="lg">
              <Link href="/search">
                <Search className="size-[18px]" aria-hidden />
                Start searching
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={signInHref}>Sign in to make playlists</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-9">
        <h2 className="text-2xl font-bold tracking-tight">Not sure what to play?</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {VIBES.map((v) => (
            <li key={v.label}>
              <Link
                href={`/search?q=${encodeURIComponent(v.q)}`}
                className="bg-ink-800 hover:bg-ink-750 flex h-9 items-center gap-2.5 rounded-full pr-4 pl-3 text-sm font-semibold transition-colors"
              >
                <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: v.color }} />
                {v.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {feed.data && (
        <>
          <CommunityShelf playlists={feed.data.community} />
          <TrendingShelf tracks={feed.data.trending} />
        </>
      )}
    </div>
  );
}
