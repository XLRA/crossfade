"use client";

import { useEffect } from "react";

import { MediaSurface, VideoDock } from "~/components/player/media-surface";
import { openShortcutsHelp, ShortcutsDialog } from "~/components/player/shortcuts-dialog";
import { useViewer } from "~/components/providers/viewer-provider";
import { setSpotifyTokenSource } from "~/lib/player/decks/spotify-sdk";
import { startMediaSession } from "~/lib/player/media-session";
import { restorePlayer, startPersisting } from "~/lib/player/persist";
import { startShortcuts } from "~/lib/player/shortcuts";
import { usePlayer } from "~/lib/player/store";
import { trackKey } from "~/lib/types";
import { api } from "~/trpc/react";

/** Everything the player needs mounted once per app shell. Renders only the media layers. */
export function PlayerRuntime() {
  useEffect(() => {
    restorePlayer();
    return startPersisting();
  }, []);
  useEffect(() => startShortcuts(openShortcutsHelp), []);
  useEffect(() => startMediaSession(), []);

  useDurationReports();
  useSpotifyPlayback();
  usePlayHistory();

  return (
    <>
      <MediaSurface />
      <VideoDock />
      <ShortcutsDialog />
    </>
  );
}

/**
 * Tracks added from a YouTube link without an API key have no duration in the catalog. Once the
 * player knows it, fill it in so playlist totals and the duration column catch up.
 */
function useDurationReports() {
  const viewer = useViewer();
  const utils = api.useUtils();
  const report = api.track.reportDuration.useMutation({
    onSuccess: ({ updated }) => {
      if (updated) void utils.playlist.byId.invalidate();
    },
  });
  const { mutate } = report;

  useEffect(() => {
    if (!viewer) return;
    const reported = new Set<string>();
    return usePlayer.subscribe(
      (s) => [s.current?.track, s.durationMs, s.status] as const,
      ([track, durationMs, status]) => {
        if (!track || track.durationMs > 0 || durationMs < 1_000 || status !== "playing") return;
        const key = trackKey(track);
        if (reported.has(key)) return;
        reported.add(key);
        mutate({ source: track.source, sourceId: track.sourceId, durationMs: Math.round(durationMs) });
      },
      { equalityFn: (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] },
    );
  }, [viewer, mutate]);
}

/** How long a track has to play before it counts as a listen: 30 s, or half of a shorter one. */
export function listenThresholdMs(durationMs: number): number {
  if (durationMs <= 0) return 30_000;
  return Math.min(30_000, Math.max(5_000, durationMs / 2));
}

/**
 * Records a listen once the current track has played long enough. Each queue entry counts once,
 * so pausing and seeking around in the same play doesn't add more.
 */
function usePlayHistory() {
  const viewer = useViewer();
  const utils = api.useUtils();
  const record = api.history.record.useMutation({
    onSuccess: ({ recorded }) => {
      if (recorded) void utils.home.feed.invalidate();
    },
  });
  const { mutate } = record;

  useEffect(() => {
    if (!viewer) return;
    let counted: string | null = null;
    return usePlayer.subscribe(
      (s) => [s.current, s.positionMs, s.durationMs, s.status] as const,
      ([current, positionMs, durationMs, status]) => {
        if (!current || status !== "playing" || counted === current.uid) return;
        if (positionMs < listenThresholdMs(durationMs)) return;
        counted = current.uid;
        const { context } = usePlayer.getState();
        mutate({
          track: { source: current.track.source, sourceId: current.track.sourceId },
          context: context ? { type: context.type, id: context.id?.slice(0, 64) } : null,
        });
      },
      { equalityFn: (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3] },
    );
  }, [viewer, mutate]);
}

/**
 * Hands the Spotify SDK deck a way to get the viewer's token when they've connected Spotify with
 * playback access. Without it (guests, Google-only accounts), Spotify tracks play in the embed.
 */
function useSpotifyPlayback() {
  const connections = useViewer()?.connections;
  const canStream = Boolean(connections?.spotifyPlayback && !connections.spotifyExpired);
  const utils = api.useUtils();

  useEffect(() => {
    if (!canStream) {
      setSpotifyTokenSource(null);
      return;
    }
    setSpotifyTokenSource(() => utils.client.account.spotifyPlaybackToken.query());
    return () => setSpotifyTokenSource(null);
  }, [canStream, utils]);
}
