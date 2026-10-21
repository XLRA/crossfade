/** Types shared between server and client code. Must not import anything server-only. */

/** Which outside accounts the signed-in user has linked. */
export type Connections = {
  spotify: boolean;
  /** Linked, but the tokens were revoked or aged out; needs reconnecting. */
  spotifyExpired: boolean;
  /** Granted the scopes the Web Playback SDK needs (Premium is checked by the SDK itself). */
  spotifyPlayback: boolean;
  google: boolean;
  /** Granted read access to their YouTube library (asked for separately from sign in). */
  youtube: boolean;
  /** Linked sign-in methods; the last one can't be disconnected. */
  loginMethods: number;
};

export type Viewer = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  image: string | null;
  connections: Connections;
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

/** Just enough to identify a track on its platform. What the client sends the server. */
export type TrackRef = Pick<TrackData, "source" | "sourceId">;

/** Stable key for a track across the app, e.g. "YOUTUBE:dQw4w9WgXcQ". */
export function trackKey(track: TrackRef): string {
  return `${track.source}:${track.sourceId}`;
}

export type ProviderStatus = "ok" | "disabled" | "quota" | "unavailable";

/** Spotify-style cover: one image, or a 2x2 mosaic once there are four different ones. */
export function coverImages(artworks: (string | null | undefined)[]): string[] {
  const distinct = [...new Set(artworks.filter((url): url is string => Boolean(url)))];
  if (distinct.length >= 4) return distinct.slice(0, 4);
  return distinct.slice(0, 1);
}
