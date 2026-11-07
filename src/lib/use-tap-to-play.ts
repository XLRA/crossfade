"use client";

import { TOUCH_QUERY, useMediaQuery } from "~/lib/use-media-query";

/**
 * On touch screens a tap anywhere on a track row or card plays it: there's no hover to reveal
 * the play button, and a double tap zooms instead of double-clicking. Taps on the controls
 * inside (buttons, links) still do their own thing.
 */
export function useTapToPlay(play: (() => void) | undefined) {
  const touch = useMediaQuery(TOUCH_QUERY);
  if (!touch || !play) return undefined;
  return (event: React.MouseEvent) => {
    if ((event.target as Element).closest("button, a, input")) return;
    play();
  };
}
