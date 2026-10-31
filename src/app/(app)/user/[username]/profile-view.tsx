"use client";

import Link from "next/link";

import { PlaylistCard } from "~/components/playlists/playlist-card";
import { Avatar } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";
import { plural } from "~/lib/format";
import { hueOf } from "~/lib/hue";
import { api } from "~/trpc/react";

export function ProfileView({ username }: { username: string }) {
  const query = api.user.profile.useQuery(
    { username },
    { retry: (count, error) => error.data?.code !== "NOT_FOUND" && count < 2 },
  );

  if (query.isLoading) return <ProfileSkeleton />;
  if (!query.data) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="font-display text-3xl">Couldn&apos;t find that profile</p>
        <p className="text-fg-muted mt-3">
          {query.error?.data?.code === "NOT_FOUND"
            ? `No one goes by @${username}. Usernames can change, so the link may be out of date.`
            : "Something went wrong loading it. Try again in a moment."}
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    );
  }

  const { user, isYou, playlists } = query.data;
  const name = user.name ?? `@${user.username}`;
  const hue = hueOf(user.id);
  const titleSize = name.length > 24 ? "text-[clamp(30px,6.4cqi,64px)]" : "text-[clamp(36px,9cqi,92px)]";

  return (
    <div className="@container relative min-h-full">
      <header
        className="flex flex-col items-center gap-6 px-6 pt-20 pb-6 @xl:flex-row @xl:items-end"
        style={{ background: `linear-gradient(180deg, hsl(${hue} 30% 34%) 0%, hsl(${hue} 26% 20%) 100%)` }}
      >
        <Avatar
          src={user.image}
          name={user.name ?? user.username}
          seed={user.id}
          size={192}
          className="shadow-[var(--shadow-art)]"
        />
        <div className="min-w-0 text-center @xl:text-left">
          <p className="text-sm font-medium">Profile</p>
          <h1 className={cn("font-display mt-1 line-clamp-2 leading-[1.02] break-words", titleSize)}>{name}</h1>
          <p className="mt-3 text-sm">
            {user.name && <span className="text-white/70">@{user.username} · </span>}
            {plural(playlists.length, "public playlist")}
          </p>
        </div>
      </header>

      <div style={{ background: `linear-gradient(180deg, hsl(${hue} 22% 15%) 0, var(--color-ink-900) 240px)` }}>
        {isYou && (
          <div className="flex items-center gap-3 px-6 pt-6">
            <Button asChild variant="outline" size="sm">
              <Link href="/settings">Edit profile</Link>
            </Button>
            <p className="text-fg-subtle text-xs">Only public playlists show here.</p>
          </div>
        )}

        <section className="px-3 pt-6 pb-16">
          <h2 className="px-3 text-2xl font-bold">Public playlists</h2>
          {playlists.length > 0 ? (
            <div className="mt-2 grid grid-cols-2 @lg:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5 @7xl:grid-cols-6">
              {playlists.map((playlist, i) => (
                <PlaylistCard
                  key={playlist.id}
                  eager={i < 6}
                  playlist={{
                    id: playlist.id,
                    title: playlist.title,
                    covers: playlist.covers,
                    subtitle: plural(playlist.trackCount, "track"),
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="text-fg-muted px-3 pt-3">
              {isYou
                ? "Nothing here yet. Make a playlist public from its Share button and it shows up here."
                : `${name} hasn't made any playlists public yet.`}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="@container">
      <div className="flex flex-col items-center gap-6 px-6 pt-20 pb-6 @xl:flex-row @xl:items-end">
        <div className="skeleton size-48 rounded-full" />
        <div className="w-full max-w-md space-y-3">
          <div className="skeleton h-4 w-16 rounded" />
          <div className="skeleton h-14 w-3/4 rounded" />
          <div className="skeleton h-4 w-40 rounded" />
        </div>
      </div>
    </div>
  );
}
