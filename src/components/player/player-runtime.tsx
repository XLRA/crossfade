"use client";

import { useEffect } from "react";

import { MediaSurface, VideoDock } from "~/components/player/media-surface";
import { useViewer } from "~/components/providers/viewer-provider";
import { restorePlayer, startPersisting } from "~/lib/player/persist";
import { usePlayer } from "~/lib/player/store";
import { trackKey } from "~/lib/types";
import { api } from "~/trpc/react";

/** Everything the player needs mounted once per app shell. Renders only the media layers. */
export function PlayerRuntime() {
  useEffect(() => {
    restorePlayer();
    return startPersisting();
  }, []);

  useDurationReports();

  return (
    <>
      <MediaSurface />
      <VideoDock />
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
