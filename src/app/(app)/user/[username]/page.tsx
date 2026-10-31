import { type Metadata } from "next";

import { api, HydrateClient } from "~/trpc/server";
import { ProfileView } from "./profile-view";

type Props = { params: Promise<{ username: string }> };

const handleOf = (raw: string) => decodeURIComponent(raw).replace(/^@/, "").toLowerCase();

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const username = handleOf((await params).username);
  const profile = await api.user.profile({ username }).catch(() => null);
  if (!profile) return { title: "Profile" };
  const name = profile.user.name ?? `@${profile.user.username}`;
  return { title: name, description: `Playlists by ${name} on Crossfade` };
}

export default async function ProfilePage({ params }: Props) {
  const username = handleOf((await params).username);
  await api.user.profile.prefetch({ username });
  return (
    <HydrateClient>
      <ProfileView username={username} />
    </HydrateClient>
  );
}
