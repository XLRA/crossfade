"use client";

import { useEffect } from "react";

import { MediaSurface, VideoDock } from "~/components/player/media-surface";
import { restorePlayer, startPersisting } from "~/lib/player/persist";

/** Everything the player needs mounted once per app shell. Renders only the media layers. */
export function PlayerRuntime() {
  useEffect(() => {
    restorePlayer();
    return startPersisting();
  }, []);

  return (
    <>
      <MediaSurface />
      <VideoDock />
    </>
  );
}
