"use client";

import { usePlayer } from "./store";

/**
 * Hardware media keys, the lock screen and the OS media overlay. Browsers route these to the
 * frame that's making sound, which is often a platform iframe, so this is best effort: it works
 * fully wherever the top page owns the session.
 */
export function startMediaSession(): () => void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return () => undefined;
  const session = navigator.mediaSession;
  const player = () => usePlayer.getState();

  const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
    ["play", () => player().play()],
    ["pause", () => player().pause()],
    ["previoustrack", () => player().previous()],
    ["nexttrack", () => player().next()],
    ["seekbackward", (d) => player().seek(player().positionMs - (d.seekOffset ?? 10) * 1000)],
    ["seekforward", (d) => player().seek(player().positionMs + (d.seekOffset ?? 10) * 1000)],
    ["seekto", (d) => d.seekTime !== undefined && player().seek(d.seekTime * 1000)],
  ];
  for (const [action, handler] of handlers) {
    try {
      session.setActionHandler(action, handler);
    } catch {
      // Not every browser supports every action.
    }
  }

  const unsubscribeTrack = usePlayer.subscribe(
    (state) => state.current?.track,
    (track) => {
      if (!track) {
        session.metadata = null;
        return;
      }
      session.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album ?? (track.source === "YOUTUBE" ? "YouTube" : ""),
        artwork: track.artworkUrl ? [{ src: track.artworkUrl, sizes: "320x320", type: "image/jpeg" }] : [],
      });
    },
    { fireImmediately: true },
  );

  const unsubscribeStatus = usePlayer.subscribe(
    (state) => state.status,
    (status) => {
      session.playbackState = status === "playing" ? "playing" : status === "paused" ? "paused" : "none";
    },
    { fireImmediately: true },
  );

  const interval = setInterval(() => {
    const { durationMs, positionMs, status } = player();
    if (status !== "playing" || durationMs <= 0) return;
    try {
      session.setPositionState({
        duration: durationMs / 1000,
        position: Math.min(positionMs, durationMs) / 1000,
        playbackRate: 1,
      });
    } catch {
      // Position briefly past duration during a skip.
    }
  }, 2_000);

  return () => {
    unsubscribeTrack();
    unsubscribeStatus();
    clearInterval(interval);
    for (const [action] of handlers) {
      try {
        session.setActionHandler(action, null);
      } catch {
        // ignore
      }
    }
  };
}
