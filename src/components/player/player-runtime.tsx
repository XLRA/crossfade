"use client";

import { MediaSurface, VideoDock } from "~/components/player/media-surface";

/** Everything the player needs mounted once per app shell. Renders only the media layers. */
export function PlayerRuntime() {
  return (
    <>
      <MediaSurface />
      <VideoDock />
    </>
  );
}
