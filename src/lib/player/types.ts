import { type TrackData } from "~/lib/types";

/** One entry in the play order. The uid keeps duplicates of the same track apart. */
export type QueueItem = { uid: string; track: TrackData };

/** Where the current list came from, shown as "Playing from …" and linked back to. */
export type PlayContext = {
  type: "playlist" | "search" | "link" | "liked" | "history" | "profile" | "home";
  id?: string;
  title: string;
  href?: string;
};

export type RepeatMode = "off" | "all" | "one";

export type PlaybackStatus = "idle" | "loading" | "playing" | "paused";

/** The playback backends. Spotify tracks use the SDK for Premium accounts, the embed otherwise. */
export type EngineKind = "youtube" | "spotify-sdk" | "spotify-embed";

/** Which iframe layer of the media surface is visible. */
export type SurfaceLayer = "yt-a" | "yt-b" | "embed";

/**
 * What the store needs from the playback controller. The controller owns the platform players;
 * the store owns the queue and the state the UI renders.
 */
export interface PlaybackController {
  load(item: QueueItem, options: { autoplay: boolean; startMs?: number }): void;
  play(): void;
  pause(): void;
  seek(ms: number): void;
  /** Re-reads volume and mute from the store. */
  applyVolume(): void;
  stop(): void;
  /** Whether a player already has this exact queue item loaded (so play can resume it). */
  holds(item: QueueItem): boolean;
}
