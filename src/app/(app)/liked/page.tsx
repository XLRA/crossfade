import { type Metadata } from "next";
import { redirect } from "next/navigation";

import { BASE_PATH } from "~/lib/base-path";
import { api, HydrateClient } from "~/trpc/server";
import { getViewer } from "~/server/viewer";
import { LikedView } from "./liked-view";

export const metadata: Metadata = { title: "Liked Songs" };

export default async function LikedPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/signin?callbackUrl=${encodeURIComponent(`${BASE_PATH}/liked`)}`);

  await api.likes.list.prefetch();
  return (
    <HydrateClient>
      <LikedView owner={{ id: viewer.id, name: viewer.name, username: viewer.username, image: viewer.image }} />
    </HydrateClient>
  );
}
