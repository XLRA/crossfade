"use client";

import { toast } from "sonner";

import { continuesAlbum, equalPower } from "./blend";
import { SpotifyEmbedDeck } from "./decks/spotify-embed";
import { SpotifySdkDeck } from "./decks/spotify-sdk";
import { type Deck, type DeckErrorKind, type DeckListener, type DeckState } from "./decks/types";
import { YouTubeDeck } from "./decks/youtube";
import { peekNext } from "./queue";
import { effectiveVolume, registerController, usePlayer } from "./store";
import { type PlaybackController, type QueueItem, type SurfaceLayer } from "./types";

export type SurfaceHosts = { ytA: HTMLElement; ytB: HTMLElement; embed: HTMLElement };

/** A volume ramp on one or two decks, stepped every FADE_STEP_MS. */
type Ramp = {
  kind: "blend" | "out" | "in";
  /** Fades down (blend, out). */
  outgoing: Deck | null;
  /** Fades up (blend, in). */
  incoming: Deck | null;
  durationMs: number;
  requestedAt: number;
  /** When the curve actually started; blends and fade-ins wait for the incoming track to play. */
  startedAt: number | null;
  timer: ReturnType<typeof setInterval>;
};

const TICK_MS = 250;
const FADE_STEP_MS = 50;
/** Longest we hold a ramp waiting for the incoming track to start before running it anyway. */
const FADE_START_TIMEOUT_MS = 4_000;
/** Tracks shorter than two fades plus this don't get blended. */
const MIN_BLEND_MARGIN_MS = 5_000;
/** When two tracks can't overlap, the first fades out over at most this long... */
const MAX_FADE_OUT_MS = 3_000;
/** ...and the next fades in over this long. */
const FADE_IN_MS = 1_200;

/**
 * Runs the platform players for the store. Each track plays on a deck; a crossfade starts the
 * next track on a second deck and moves both volumes along an equal-power curve (cos/sin), so
 * loudness holds steady through the blend instead of dipping in the middle.
 *
 * Not every handoff can overlap. Spotify's SDK plays one stream per account, so between two
 * Spotify tracks the first fades out and the next fades in. The Spotify embed has no volume
 * control at all, so handoffs to or from it are plain cuts. And one track running into the next
 * on the same album isn't blended at all, so albums play the way they were sequenced.
 */
export class PlayerController implements PlaybackController, DeckListener {
  private readonly ytA: YouTubeDeck;
  private readonly ytB: YouTubeDeck;
  private readonly spotifySdk: SpotifySdkDeck;
  private readonly spotifyEmbed: SpotifyEmbedDeck;
  protected readonly decks: Deck[];

  private active: Deck | null = null;
  private activeItem: QueueItem | null = null;
  private ramp: Ramp | null = null;
  /** Set when a track faded out because the next one couldn't overlap it: fade that one in. */
  private fadeInNext = false;
  private ticker: ReturnType<typeof setInterval> | null = null;
  /** Since when the active track has sat at its very end while "playing". */
  private stuckAtEndSince: number | null = null;
  private toldAboutPreviews = false;

  constructor(hosts: SurfaceHosts) {
    this.ytA = new YouTubeDeck("yt-a", hosts.ytA);
    this.ytB = new YouTubeDeck("yt-b", hosts.ytB);
    this.spotifySdk = new SpotifySdkDeck();
    this.spotifyEmbed = new SpotifyEmbedDeck(hosts.embed);
    this.decks = [this.ytA, this.ytB, this.spotifySdk, this.spotifyEmbed];
    for (const deck of this.decks) deck.listener = this;
    registerController(this);
    this.spotifySdk.warmUp();
  }

  destroy() {
    registerController(null);
    this.stop();
    this.spotifySdk.destroy();
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
    return this.spotifySdk.usable ? this.spotifySdk : this.spotifyEmbed;
  }

  private layerOf(deck: Deck | null): SurfaceLayer | null {
    if (deck === this.ytA) return "yt-a";
    if (deck === this.ytB) return "yt-b";
    if (deck === this.spotifyEmbed) return "embed";
    // The SDK has no picture; the UI shows the artwork.
    return null;
  }

  private show(deck: Deck | null) {
    this.store._surface(this.layerOf(deck), deck?.kind ?? null);
  }

  private start(
    deck: Deck,
    item: QueueItem,
    { autoplay, startMs, volume }: { autoplay: boolean; startMs: number; volume: number },
  ) {
    for (const other of this.decks) if (other !== deck && other.loadedId()) other.stop();
    this.active = deck;
    this.activeItem = item;
    deck.load(item.track.sourceId, { autoplay, startMs, volume, durationMs: item.track.durationMs });
    this.show(deck);
    this.startTicking();
  }

  // --- PlaybackController ---------------------------------------------------------------------

  load(item: QueueItem, { autoplay, startMs = 0 }: { autoplay: boolean; startMs?: number }) {
    const fadeIn = this.fadeInNext && autoplay;
    this.fadeInNext = false;
    this.endRamp();
    const deck = this.deckFor(item, { transition: false });
    const rampUp = fadeIn && deck.canFade;
    this.start(deck, item, { autoplay, startMs, volume: rampUp ? 0 : this.volume() });
    if (rampUp) this.beginRamp({ kind: "in", outgoing: null, incoming: deck, durationMs: FADE_IN_MS });
  }

  holds(item: QueueItem) {
    return this.activeItem?.uid === item.uid && this.active?.loadedId() === item.track.sourceId;
  }

  play() {
    this.endRamp();
    this.active?.play();
  }

  pause() {
    this.endRamp();
    this.active?.pause();
  }

  seek(ms: number) {
    this.endRamp();
    this.active?.seek(ms);
  }

  applyVolume() {
    // Mid-ramp, the ramp applies the new volume on its next step.
    if (!this.ramp) this.active?.setVolume(this.volume());
  }

  stop() {
    this.endRamp();
    this.fadeInNext = false;
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
    const blending = this.ramp?.kind === "blend";
    switch (state) {
      case "playing":
        store._status("playing");
        break;
      case "buffering":
        if (store.status !== "paused") store._status(store.status === "idle" ? "loading" : store.status, true);
        break;
      case "paused":
        if (!blending) store._status("paused");
        break;
      case "ended":
        if (!blending) store._ended();
        break;
    }
  }

  error(deck: Deck, _kind: DeckErrorKind, message: string) {
    if (deck !== this.active || !this.activeItem) return;
    this.endRamp();

    // The SDK can't play here after all (no Premium, no DRM support, connection revoked). The
    // embed takes over the same track from the same spot, and keeps every Spotify track after it.
    if (deck === this.spotifySdk && !this.spotifySdk.usable) {
      if (!this.toldAboutPreviews) {
        this.toldAboutPreviews = true;
        toast(message);
      }
      const store = this.store;
      this.start(this.spotifyEmbed, this.activeItem, {
        autoplay: store.status !== "paused",
        startMs: store.positionMs,
        volume: this.volume(),
      });
      return;
    }

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
    const store = this.store;
    store._progress(position, duration);
    if (store.status !== "playing") {
      this.stuckAtEndSince = null;
      return;
    }

    // The Spotify players have no real "ended" event. If one sits at the end of its track while
    // still claiming to play, move on rather than hang there.
    if (duration > 0 && position >= duration - 250) {
      this.stuckAtEndSince ??= Date.now();
      if (Date.now() - this.stuckAtEndSince > 2_000) {
        this.stuckAtEndSince = null;
        if (this.ramp?.kind !== "blend") store._ended();
        return;
      }
    } else {
      this.stuckAtEndSince = null;
    }

    if (!this.ramp) this.maybeBlend(position, duration);
  }

  private maybeBlend(position: number, duration: number) {
    const store = this.store;
    const active = this.active;
    const fadeMs = store.crossfadeSeconds * 1000;
    if (!active?.canFade || fadeMs <= 0 || duration <= 0 || position <= 0) return;
    if (duration < fadeMs * 2 + MIN_BLEND_MARGIN_MS) return;
    const remaining = duration - position;
    if (remaining > fadeMs) return;

    const next = peekNext(store, { auto: true });
    if (!next || next.uid === store.current?.uid) return;
    if (store.current && continuesAlbum(store.current.track, next.track)) return;
    const incoming = this.deckFor(next, { transition: true });

    if (incoming !== active && incoming.canFade) {
      this.beginBlend(incoming, Math.max(1_000, remaining));
    } else if (remaining <= Math.min(fadeMs, MAX_FADE_OUT_MS)) {
      // Can't overlap: fade this one out; the next one fades in when it starts.
      this.beginRamp({ kind: "out", outgoing: active, incoming: null, durationMs: Math.max(500, remaining) });
      this.fadeInNext = true;
    }
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
    incoming.load(item.track.sourceId, { autoplay: true, startMs: 0, volume: 0, durationMs: item.track.durationMs });
    this.show(incoming);
    this.beginRamp({ kind: "blend", outgoing, incoming, durationMs });
  }

  private beginRamp(ramp: Omit<Ramp, "requestedAt" | "startedAt" | "timer">) {
    this.endRamp();
    this.ramp = {
      ...ramp,
      requestedAt: Date.now(),
      // Fading out starts now; anything with an incoming track waits for it to play.
      startedAt: ramp.incoming ? null : Date.now(),
      timer: setInterval(() => this.stepRamp(), FADE_STEP_MS),
    };
  }

  private stepRamp() {
    const ramp = this.ramp;
    if (!ramp) return;
    const now = Date.now();
    if (ramp.startedAt === null) {
      // Hold the curve until the incoming track is actually playing so a slow start doesn't
      // swallow the blend; the outgoing track keeps going at full volume meanwhile.
      const started = ramp.incoming!.isPlaying() && ramp.incoming!.positionMs() > 50;
      if (!started && now - ramp.requestedAt < FADE_START_TIMEOUT_MS) return;
      ramp.startedAt = now;
    }
    const t = Math.min(1, (now - ramp.startedAt) / ramp.durationMs);
    const volume = this.volume();
    const gains = equalPower(t);
    if (ramp.outgoing?.canFade) ramp.outgoing.setVolume(volume * gains.outgoing);
    if (ramp.incoming?.canFade) ramp.incoming.setVolume(volume * gains.incoming);
    if (t < 1) return;

    if (ramp.kind === "out") {
      // Stay silent until the track ends and the next one takes over.
      clearInterval(ramp.timer);
      return;
    }
    this.endRamp();
  }

  /**
   * Finishes (or abandons) a ramp at once. After a blend the outgoing deck stops; anything still
   * playing goes back to full volume.
   */
  private endRamp() {
    const ramp = this.ramp;
    if (!ramp) return;
    clearInterval(ramp.timer);
    this.ramp = null;
    if (ramp.kind === "blend") ramp.outgoing?.stop();
    this.active?.setVolume(this.volume());
  }
}
