import { type EngineKind } from "../types";

export type DeckState = "playing" | "paused" | "buffering" | "ended";

export type DeckErrorKind = "not_found" | "not_embeddable" | "unsupported" | "auth" | "premium" | "network";

export interface DeckListener {
  state(deck: Deck, state: DeckState): void;
  error(deck: Deck, kind: DeckErrorKind, message: string): void;
}

/**
 * One playback surface: a YouTube iframe player, the Spotify Web Playback SDK, or a Spotify
 * embed. The controller crossfades by running two decks at once.
 */
export interface Deck {
  readonly id: string;
  readonly kind: EngineKind;
  /** Whether volume can be set, which is what fading needs. The Spotify embed can't. */
  readonly canFade: boolean;
  listener: DeckListener | null;

  load(sourceId: string, options: { autoplay: boolean; startMs: number; volume: number }): void;
  play(): void;
  pause(): void;
  /** Stops and forgets the loaded track. */
  stop(): void;
  seek(ms: number): void;
  /** 0–1. */
  setVolume(volume: number): void;
  positionMs(): number;
  durationMs(): number;
  /** Whether the deck is currently producing sound (or trying to). */
  isPlaying(): boolean;
  loadedId(): string | null;
}
