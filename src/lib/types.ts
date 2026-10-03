/** Types shared between server and client code. Must not import anything server-only. */

export type Viewer = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  image: string | null;
};

export type SourceName = "SPOTIFY" | "YOUTUBE";

/**
 * A track as every part of the app sees it, whatever platform it streams from. Platform
 * adapters produce these; the catalog stores them; the player consumes them.
 */
export type TrackData = {
  source: SourceName;
  /** Spotify track id or YouTube video id. */
  sourceId: string;
  title: string;
  artist: string;
  album: string | null;
  albumId: string | null;
  artworkUrl: string | null;
  durationMs: number;
  explicit: boolean;
  isrc: string | null;
};

/** Stable key for a track across the app, e.g. "YOUTUBE:dQw4w9WgXcQ". */
export function trackKey(track: Pick<TrackData, "source" | "sourceId">): string {
  return `${track.source}:${track.sourceId}`;
}

export type ProviderStatus = "ok" | "disabled" | "quota" | "unavailable";
