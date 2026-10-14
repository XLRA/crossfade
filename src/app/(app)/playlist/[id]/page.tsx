import { type Metadata } from "next";

import { api, HydrateClient } from "~/trpc/server";
import { PlaylistView } from "./playlist-view";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const playlist = await api.playlist.byId({ id }).catch(() => null);
  if (!playlist) return { title: "Playlist" };
  return {
    title: playlist.title,
    description: playlist.description ?? `A Crossfade playlist by ${playlist.owner.name ?? playlist.owner.username}`,
  };
}

export default async function PlaylistPage({ params }: Props) {
  const { id } = await params;
  await api.playlist.byId.prefetch({ id });
  return (
    <HydrateClient>
      <PlaylistView id={id} />
    </HydrateClient>
  );
}
