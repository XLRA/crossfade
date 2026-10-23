"use client";

import { SpotifyEmbedDeck } from "./decks/spotify-embed";
import { type Deck, type DeckErrorKind, type DeckListener, type DeckState } from "./decks/types";
import { YouTubeDeck } from "./decks/youtube";
import { peekNext } from "./queue";
import { effectiveVolume, registerController, usePlayer } from "./store";
import { type PlaybackController, type QueueItem, type SurfaceLayer } from "./types";

export type SurfaceHosts = { ytA: HTMLElement; ytB: HTMLElement; embed: HTMLElement };

type Fade = {
  outgoing: Deck;
  incoming: Deck;
  durationMs: number;
  requestedAt: number;
  /** When the incoming track actually started; the curve runs from here. */
  startedAt: number | null;
  timer: ReturnType<typeof setInterval>;
};

const TICK_MS = 250;
const FADE_STEP_MS = 50;
/** Longest we hold a blend waiting for the incoming track to start before running it anyway. */
const FADE_START_TIMEOUT_MS = 4_000;
/** Tracks shorter than two fades plus this don't get blended. */
const MIN_BLEND_MARGIN_MS = 5_000;

/**
 * Runs the platform players for the store. Each track plays on a deck; a crossfade starts the
 * next track on a second deck and moves both volumes along an equal-power curve (cos/sin), so
 * loudness holds steady through the blend instead of dipping in the middle.
 *
 * Spotify tracks play in Spotify's embed, which has no volume control: it can't be faded, so
 * handoffs away from it are plain cuts, and a blend into it only fades the outgoing track.
 */
export class PlayerController implements PlaybackController, DeckListener {
  private readonly ytA: YouTubeDeck;
  private readonly ytB: YouTubeDeck;
  private readonly spotifyEmbed: SpotifyEmbedDeck;
  protected readonly decks: Deck[];

  private active: Deck | null = null;
  private activeItem: QueueItem | null = null;
  private fade: Fade | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;

  constructor(hosts: SurfaceHosts) {
    this.ytA = new YouTubeDeck("yt-a", hosts.ytA);
    this.ytB = new YouTubeDeck("yt-b", hosts.ytB);
    this.spotifyEmbed = new SpotifyEmbedDeck(hosts.embed);
    this.decks = [this.ytA, this.ytB, this.spotifyEmbed];
    for (const deck of this.decks) deck.listener = this;
    registerController(this);
  }

  destroy() {
    registerController(null);
    this.stop();
    for (const deck of this.decks) deck.listener = null;
  }

  private get store() {
    return usePlayer.getState();
  }

  private volume() {
    return effectiveVolume(this.store);
  }

  /** The deck an item plays on. During a blend YouTube alternates between its two decks. */
  protected deckFor(item: QueueItem, { transition }: { transition: boolean }): Deck {
    if (item.track.source === "YOUTUBE") {
      if (this.active === this.ytA) return transition ? this.ytB : this.ytA;
      if (this.active === this.ytB) return transition ? this.ytA : this.ytB;
      return this.ytA;
    }
    return this.spotifyEmbed;
  }

  private layerOf(deck: Deck | null): SurfaceLayer | null {
    if (!deck) return null;
    if (deck === this.ytA) return "yt-a";
    if (deck === this.ytB) return "yt-b";
    if (deck === this.spotifyEmbed) return "embed";
    return null;
  }

  private show(deck: Deck | null) {
    this.store._surface(this.layerOf(deck), deck?.kind ?? null);
  }

  // --- PlaybackController ---------------------------------------------------------------------

  load(item: QueueItem, { autoplay, startMs = 0 }: { autoplay: boolean; startMs?: number }) {
    this.endFade();
    const deck = this.deckFor(item, { transition: false });
    for (const other of this.decks) if (other !== deck && other.loadedId()) other.stop();
    this.active = deck;
    this.activeItem = item;
    deck.load(item.track.sourceId, { autoplay, startMs, volume: this.volume(), durationMs: item.track.durationMs });
    this.show(deck);
    this.startTicking();
  }

  holds(item: QueueItem) {
    return this.activeItem?.uid === item.uid && this.active?.loadedId() === item.track.sourceId;
  }

  play() {
    this.endFade();
    this.active?.play();
  }

  pause() {
    this.endFade();
    this.active?.pause();
  }

  seek(ms: number) {
    this.endFade();
    this.active?.seek(ms);
  }

  applyVolume() {
    // Mid-blend, the fade loop applies the new volume on its next step.
    if (!this.fade) this.active?.setVolume(this.volume());
  }

  stop() {
    this.endFade();
    for (const deck of this.decks) if (deck.loadedId()) deck.stop();
    this.active = null;
    this.activeItem = null;
    this.show(null);
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  }

  // --- DeckListener ---------------------------------------------------------------------------

  state(deck: Deck, state: DeckState) {
    // The outgoing deck of a blend just plays out; only the active deck drives the UI.
    if (deck !== this.active) return;
    const store = this.store;
    switch (state) {
      case "playing":
        store._status("playing");
        break;
      case "buffering":
        if (store.status !== "paused") store._status(store.status === "idle" ? "loading" : store.status, true);
        break;
      case "paused":
        if (!this.fade) store._status("paused");
        break;
      case "ended":
        if (!this.fade) store._ended();
        break;
    }
  }

  error(deck: Deck, _kind: DeckErrorKind, message: string) {
    if (deck !== this.active || !this.activeItem) return;
    this.endFade();
    this.store._failed(this.activeItem.uid, message);
  }

  // --- Progress and blending ------------------------------------------------------------------

  private startTicking() {
    this.ticker ??= setInterval(() => this.tick(), TICK_MS);
  }

  private tick() {
    const deck = this.active;
    if (!deck?.loadedId()) return;
    const position = deck.positionMs();
    const duration = deck.durationMs();
    this.store._progress(position, duration);
    if (!this.fade && this.store.status === "playing") this.maybeBlend(position, duration);
  }

  private maybeBlend(position: number, duration: number) {
    const store = this.store;
    const fadeMs = store.crossfadeSeconds * 1000;
    // Without volume control the outgoing track can only be cut off, so let it finish instead.
    if (!this.active?.canFade) return;
    if (fadeMs <= 0 || duration <= 0 || position <= 0) return;
    if (duration < fadeMs * 2 + MIN_BLEND_MARGIN_MS) return;
    const remaining = duration - position;
    if (remaining > fadeMs) return;

    const next = peekNext(store, { auto: true });
    if (!next || next.uid === store.current?.uid) return;
    const incoming = this.deckFor(next, { transition: true });
    // A platform that can only play one thing at a time just ends and hands over normally.
    if (incoming === this.active) return;
    this.beginBlend(incoming, Math.max(1_000, remaining));
  }

  private beginBlend(incoming: Deck, durationMs: number) {
    const outgoing = this.active;
    if (!outgoing) return;
    const item = this.store._advanceForCrossfade();
    if (!item) return;

    for (const other of this.decks) {
      if (other !== outgoing && other !== incoming && other.loadedId()) other.stop();
    }
    this.active = incoming;
    this.activeItem = item;
    incoming.load(item.track.sourceId, {
      autoplay: true,
      startMs: 0,
      volume: incoming.canFade ? 0 : this.volume(),
      durationMs: item.track.durationMs,
    });
    this.show(incoming);
    this.fade = {
      outgoing,
      incoming,
      durationMs,
      requestedAt: Date.now(),
      startedAt: null,
      timer: setInterval(() => this.stepBlend(), FADE_STEP_MS),
    };
  }

  private stepBlend() {
    const fade = this.fade;
    if (!fade) return;
    const now = Date.now();
    if (fade.startedAt === null) {
      // Hold the curve until the incoming track is actually playing so a slow start doesn't
      // swallow the blend; the outgoing track keeps going at full volume meanwhile.
      const started = fade.incoming.isPlaying() && fade.incoming.positionMs() > 50;
      if (!started && now - fade.requestedAt < FADE_START_TIMEOUT_MS) return;
      fade.startedAt = now;
    }
    const t = Math.min(1, (now - fade.startedAt) / fade.durationMs);
    const volume = this.volume();
    if (fade.outgoing.canFade) fade.outgoing.setVolume(volume * Math.cos((t * Math.PI) / 2));
    if (fade.incoming.canFade) fade.incoming.setVolume(volume * Math.sin((t * Math.PI) / 2));
    if (t >= 1) this.endFade();
  }

  /** Completes (or abandons) a blend at once: the outgoing deck stops, the incoming one is at full volume. */
  private endFade() {
    const fade = this.fade;
    if (!fade) return;
    clearInterval(fade.timer);
    this.fade = null;
    fade.outgoing.stop();
    fade.incoming.setVolume(this.volume());
  }
}
