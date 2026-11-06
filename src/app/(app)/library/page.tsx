import { type Metadata } from "next";

import { LibraryContents } from "~/components/shell/library-sidebar";
import { getViewer } from "~/server/viewer";
import { api, HydrateClient } from "~/trpc/server";

export const metadata: Metadata = { title: "Your library" };

/** The library on its own page, for phones, where there's no room for the sidebar. */
export default async function LibraryPage() {
  const viewer = await getViewer();
  if (viewer) await Promise.all([api.playlist.library.prefetch(), api.likes.keys.prefetch()]);

  return (
    <HydrateClient>
      <div className="mx-auto flex max-w-[760px] flex-col pb-8">
        <LibraryContents page />
      </div>
    </HydrateClient>
  );
}
