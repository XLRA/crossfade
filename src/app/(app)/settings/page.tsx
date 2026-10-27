import { type Metadata } from "next";
import { redirect } from "next/navigation";

import { BASE_PATH } from "~/lib/base-path";
import { enabledProviders } from "~/server/auth/config";
import { getViewer } from "~/server/viewer";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/signin?callbackUrl=${encodeURIComponent(`${BASE_PATH}/settings`)}`);

  return (
    <SettingsView viewer={viewer} available={{ spotify: enabledProviders.spotify, google: enabledProviders.google }} />
  );
}
