import { CrossfadeArt } from "~/components/auth/crossfade-art";
import { GuestHome } from "~/components/home/guest-home";
import { HomeView } from "~/components/home/home-view";
import { getViewer } from "~/server/viewer";
import { api, HydrateClient } from "~/trpc/server";

export default async function HomePage() {
  const viewer = await getViewer();
  await api.home.feed.prefetch();

  return (
    <HydrateClient>
      {viewer ? <HomeView /> : <GuestHome art={<CrossfadeArt className="h-full w-full" />} />}
    </HydrateClient>
  );
}
