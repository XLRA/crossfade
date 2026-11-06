"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Phones get the bottom navigation and mini player; everything wider gets the desktop shell. */
export const DESKTOP_QUERY = "(min-width: 768px)";
/** Wide enough for the now playing and queue panel to sit beside the page instead of over it. */
export const WIDE_QUERY = "(min-width: 1024px)";

/**
 * Whether a media query matches. Always false on the server and during hydration, so only use it
 * for things that can appear a moment after the first paint (players, panels), not for layout.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
