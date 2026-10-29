import { type Metadata } from "next";
import { redirect } from "next/navigation";

import { BASE_PATH } from "~/lib/base-path";
import { enabledProviders } from "~/server/auth/config";
import { getViewer } from "~/server/viewer";
import { ImportView } from "./import-view";

export const metadata: Metadata = { title: "Import playlists" };

type SearchParams = Promise<{ source?: string }>;

export default async function ImportPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/signin?callbackUrl=${encodeURIComponent(`${BASE_PATH}/import`)}`);

  const { source } = await searchParams;
  const { connections } = viewer;
  const initial =
    source === "youtube"
      ? "YOUTUBE"
      : source === "spotify"
        ? "SPOTIFY"
        : connections.google && !connections.spotify
          ? "YOUTUBE"
          : "SPOTIFY";

  return (
    <ImportView
      initialSource={initial}
      available={{ SPOTIFY: enabledProviders.spotify, YOUTUBE: enabledProviders.google }}
    />
  );
}
