import { loadScript } from "../load-script";
import { type Deck, type DeckErrorKind, type DeckListener, type DeckLoadOptions } from "./types";

/*
 * Spotify Web Playback SDK deck: full tracks in the browser, for Premium accounts.
 * https://developer.spotify.com/documentation/web-playback-sdk
 *
 * The SDK turns this tab into a Spotify Connect device; tracks are started on it through the Web
 * API (PUT /me/player/play with our device id). It plays one stream at a time per account, so two
 * Spotify tracks can't overlap: the controller fades out and back in between them instead.
 *
 * The SDK has no "ended" event. A track that finishes reports a paused state with itself in
 * previous_tracks (or at position 0 right after being near the end), which is what we look for.
 */

type SdkTrack = { id: string | null; uri: string; linked_from?: { id: string | null; uri: string | null } };

type SdkState = {
  paused: boolean;
  position: number;
  duration: number;
  loading?: boolean;
  track_window: { current_track: SdkTrack | null; previous_tracks: SdkTrack[] };
};

type SdkPlayer = {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: "ready" | "not_ready", callback: (data: { device_id: string }) => void): boolean;
  addListener(event: "player_state_changed", callback: (state: SdkState | null) => void): boolean;
  addListener(
    event: "initialization_error" | "authentication_error" | "account_error" | "playback_error",
    callback: (error: { message: string }) => void,
  ): boolean;
  addListener(event: "autoplay_failed", callback: () => void): boolean;
  getCurrentState(): Promise<SdkState | null>;
  setVolume(volume: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  activateElement(): Promise<void>;
};

type SpotifyNamespace = {
  Player: new (options: {
    name: string;
    getOAuthToken: (callback: (token: string) => void) => void;
    volume?: number;
  }) => SdkPlayer;
};

declare global {
  interface Window {
    Spotify?: SpotifyNamespace;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

let sdk: Promise<SpotifyNamespace> | null = null;

function loadSdk(): Promise<SpotifyNamespace> {
  sdk ??= new Promise<SpotifyNamespace>((resolve, reject) => {
    if (window.Spotify?.Player) return resolve(window.Spotify);
    window.onSpotifyWebPlaybackSDKReady = () => resolve(window.Spotify!);
    loadScript("https://sdk.scdn.co/spotify-player.js").catch((error: unknown) => {
      sdk = null;
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
  return sdk;
}

// --- Where tokens come from ----------------------------------------------------------------------

/** Returns the signed-in user's Spotify access token, or null if they haven't connected Spotify. */
export type SpotifyTokenSource = () => Promise<{ accessToken: string; expiresAt: number } | null>;

let tokenSource: SpotifyTokenSource | null = null;
const sourceListeners = new Set<() => void>();

/**
 * Set by the player runtime when the viewer has a Spotify connection with playback scopes, and
 * cleared when they don't. Without one, Spotify tracks go to the embed.
 */
export function setSpotifyTokenSource(source: SpotifyTokenSource | null) {
  if (source === tokenSource) return;
  tokenSource = source;
  for (const listener of sourceListeners) listener();
}

// --- Deck ----------------------------------------------------------------------------------------

type Status = "idle" | "connecting" | "ready" | "failed";
type Failure = { kind: DeckErrorKind; message: string };
type PlayResult = "ok" | "device" | "premium" | "error";

const PREMIUM_MESSAGE = "Full tracks need Spotify Premium, so Spotify is playing previews here.";
const NEAR_END_MS = 2_500;

export class SpotifySdkDeck implements Deck {
  readonly id = "spotify-sdk";
  readonly kind = "spotify-sdk" as const;
  readonly canFade = true;
  listener: DeckListener | null = null;

  private status: Status = "idle";
  private failure: Failure | null = null;
  private player: SdkPlayer | null = null;
  private deviceId: string | null = null;
  private connecting: Promise<boolean> | null = null;
  private settleConnect: ((ok: boolean) => void) | null = null;
  private token: { value: string; expiresAt: number } | null = null;

  private trackId: string | null = null;
  /** Ids Spotify may report for the requested track (it relinks tracks per market). */
  private aliases = new Set<string>();
  /** Ids of earlier tracks, whose late state updates must not be mistaken for this one's. */
  private retired = new Set<string>();
  /** Loaded without autoplay (e.g. restored after a reload): starts on the first play(). */
  private pending: { startMs: number } | null = null;
  private playing = false;
  private volume = 1;
  private durationHint = 0;
  private snapshot: { position: number; duration: number; paused: boolean; at: number } | null = null;
  private nearEnd = false;
  private endedFor: string | null = null;
  private poll: ReturnType<typeof setInterval> | undefined;

  constructor() {
    sourceListeners.add(this.onSourceChange);
  }

  /** Whether Spotify tracks should come here: there's a connection and the SDK hasn't failed. */
  get usable(): boolean {
    return tokenSource !== null && this.status !== "failed";
  }

  /** The reason the SDK can't be used, once it has failed. */
  get failureMessage(): string | null {
    return this.failure?.message ?? null;
  }

  /** Connects ahead of the first Spotify track, so pressing play isn't kept waiting. */
  warmUp() {
    if (this.usable) void this.ensureReady();
  }

  destroy() {
    sourceListeners.delete(this.onSourceChange);
    this.teardown();
  }

  private onSourceChange = () => {
    // Signed out, disconnected Spotify, or connected it: start over either way.
    this.teardown();
    this.status = "idle";
    this.failure = null;
    if (tokenSource) this.warmUp();
  };

  private teardown() {
    this.stop();
    this.stopPolling();
    this.player?.disconnect();
    this.player = null;
    this.deviceId = null;
    this.token = null;
    this.connecting = null;
    this.settleConnect?.(false);
  }

  // --- Connection ---------------------------------------------------------------------------------

  private async getToken(): Promise<string | null> {
    if (this.token && this.token.expiresAt - 60_000 > Date.now()) return this.token.value;
    const source = tokenSource;
    if (!source) return null;
    const result = await source().catch(() => null);
    if (!result) return null;
    this.token = { value: result.accessToken, expiresAt: result.expiresAt };
    return result.accessToken;
  }

  private fail(kind: DeckErrorKind, message: string): false {
    this.status = "failed";
    this.failure = { kind, message };
    return false;
  }

  private ensureReady(): Promise<boolean> {
    if (this.status === "ready" && this.deviceId) return Promise.resolve(true);
    if (!this.usable) return Promise.resolve(false);
    this.connecting ??= this.connect().then((ok) => {
      this.connecting = null;
      if (ok) this.status = "ready";
      return ok;
    });
    return this.connecting;
  }

  private async connect(): Promise<boolean> {
    this.status = "connecting";
    // Spotify streams are DRM protected (Widevine through EME).
    if (typeof navigator.requestMediaKeySystemAccess !== "function") {
      return this.fail("unsupported", "This browser can't play protected audio, so Spotify is playing previews here.");
    }
    if (!(await this.getToken())) return this.fail("auth", "Reconnect Spotify in Settings to play full tracks.");

    let Spotify: SpotifyNamespace;
    try {
      Spotify = await loadSdk();
    } catch {
      return this.fail("network", "Spotify's player didn't load, so Spotify is playing previews here.");
    }
    if (!tokenSource) return false;

    const player = (this.player ??= this.createPlayer(Spotify));
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => settle(this.fail("network", "Spotify's player didn't start in time.")), 15_000);
      const settle = (ok: boolean) => {
        clearTimeout(timer);
        this.settleConnect = null;
        resolve(ok);
      };
      this.settleConnect = settle;
      void player.connect().then((ok) => {
        if (!ok) settle(this.fail("unsupported", "Spotify's player couldn't connect in this browser."));
      });
    });
  }

  private createPlayer(Spotify: SpotifyNamespace): SdkPlayer {
    const player = new Spotify.Player({
      name: "Crossfade",
      volume: this.volume,
      getOAuthToken: (callback) => {
        void this.getToken().then((token) => token && callback(token));
      },
    });
    player.addListener("ready", ({ device_id }) => {
      this.deviceId = device_id;
      this.settleConnect?.(true);
    });
    player.addListener("not_ready", () => {
      this.deviceId = null;
      if (this.status === "ready") this.status = "idle";
    });
    player.addListener("initialization_error", () => {
      this.settleConnect?.(this.fail("unsupported", "Spotify's player doesn't work in this browser."));
    });
    player.addListener("authentication_error", () => {
      this.token = null;
      this.onFatal("auth", "Spotify signed us out. Reconnect Spotify in Settings to play full tracks.");
    });
    player.addListener("account_error", () => this.onFatal("premium", PREMIUM_MESSAGE));
    player.addListener("playback_error", ({ message }) => {
      if (this.trackId && this.playing) console.warn("[spotify] playback error:", message);
    });
    player.addListener("autoplay_failed", () => {
      // The browser wants a click first; the play button provides it.
      if (!this.playing) return;
      this.playing = false;
      this.listener?.state(this, "paused");
    });
    player.addListener("player_state_changed", (state) => this.onState(state));
    return player;
  }

  /** Account or auth problems: stop using the SDK, and let the controller move the track. */
  private onFatal(kind: DeckErrorKind, message: string) {
    this.fail(kind, message);
    this.settleConnect?.(false);
    if (this.trackId) this.report();
  }

  private report() {
    const failure = this.failure ?? { kind: "network" as const, message: "Spotify didn't start the track. Try again." };
    this.playing = false;
    this.stopPolling();
    this.listener?.error(this, failure.kind, failure.message);
  }

  // --- Starting tracks ----------------------------------------------------------------------------

  private async start(id: string, startMs: number) {
    const ok = await this.ensureReady();
    if (this.trackId !== id) return;
    if (!ok) return this.report();

    this.listener?.state(this, "buffering");
    await this.player?.setVolume(this.volume).catch(() => undefined);
    let result = await this.playOnDevice(id, startMs);
    if (result === "device" && this.trackId === id) {
      // The device dropped (network change, tab asleep). Reconnect once and retry.
      this.deviceId = null;
      this.status = "idle";
      result = (await this.ensureReady()) ? await this.playOnDevice(id, startMs) : "error";
    }
    if (this.trackId !== id) return;
    if (result === "ok") return this.startPolling();
    if (result === "premium") this.fail("premium", PREMIUM_MESSAGE);
    this.report();
  }

  private async playOnDevice(id: string, startMs: number): Promise<PlayResult> {
    const token = await this.getToken();
    if (!token) return "error";
    if (!this.deviceId) return "device";
    const res = await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(this.deviceId)}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uris: [`spotify:track:${id}`], position_ms: Math.max(0, Math.round(startMs)) }),
      },
    ).catch(() => null);
    if (!res) return "error";
    if (res.ok) return "ok";
    if (res.status === 404) return "device";
    // PREMIUM_REQUIRED, or an account a development-mode app doesn't serve.
    if (res.status === 403) return "premium";
    if (res.status === 401) this.token = null;
    return "error";
  }

  // --- State --------------------------------------------------------------------------------------

  private matches(track: SdkTrack | null | undefined): boolean {
    if (!track) return false;
    if (track.id && this.aliases.has(track.id)) return true;
    if (track.linked_from?.id && this.aliases.has(track.linked_from.id)) return true;
    if (track.uri === `spotify:track:${this.trackId}`) return true;
    return false;
  }

  private onState(state: SdkState | null) {
    if (!this.trackId) return;
    if (!state) {
      // Playback moved to another device, or the SDK lost its connection.
      if (this.playing) {
        this.playing = false;
        this.stopPolling();
        this.listener?.state(this, "paused");
      }
      return;
    }

    const current = state.track_window.current_track;
    if (!current) return;
    if (!this.matches(current)) {
      // A relinked version of the requested track has its own id. Adopt it, unless it's the
      // previous track reporting late.
      if (!current.id || this.retired.has(current.id) || this.aliases.size > 1) return;
      this.aliases.add(current.id);
    }

    this.snapshot = {
      position: state.position,
      duration: state.duration || this.durationHint,
      paused: state.paused,
      at: performance.now(),
    };

    const finished =
      state.paused &&
      (state.track_window.previous_tracks.some((t) => this.matches(t)) || (this.nearEnd && state.position === 0));
    if (finished) {
      if (this.endedFor === this.trackId) return;
      this.endedFor = this.trackId;
      this.playing = false;
      this.stopPolling();
      this.listener?.state(this, "ended");
      return;
    }

    if (state.loading) {
      this.listener?.state(this, "buffering");
    } else if (state.paused) {
      this.playing = false;
      this.listener?.state(this, "paused");
    } else {
      this.playing = true;
      this.listener?.state(this, "playing");
    }
  }

  /** State events only come on changes; this keeps the position honest in between. */
  private startPolling() {
    this.stopPolling();
    this.poll = setInterval(() => {
      void this.player
        ?.getCurrentState()
        .then((state) => state && this.onState(state))
        .catch(() => undefined);
    }, 1_000);
  }

  private stopPolling() {
    clearInterval(this.poll);
    this.poll = undefined;
  }

  // --- Deck ---------------------------------------------------------------------------------------

  load(trackId: string, { autoplay, startMs, volume, durationMs = 0 }: DeckLoadOptions) {
    for (const id of this.aliases) this.retired.add(id);
    this.retired.delete(trackId);
    this.trackId = trackId;
    this.aliases = new Set([trackId]);
    this.volume = volume;
    this.durationHint = durationMs;
    this.snapshot = { position: startMs, duration: durationMs, paused: true, at: performance.now() };
    this.nearEnd = false;
    this.endedFor = null;
    this.playing = autoplay;
    this.pending = autoplay ? null : { startMs };
    // Counts as the click browsers want before audio, when the player already exists.
    void this.player?.activateElement().catch(() => undefined);
    if (autoplay) void this.start(trackId, startMs);
    else void this.ensureReady();
  }

  play() {
    if (!this.trackId) return;
    void this.player?.activateElement().catch(() => undefined);
    this.playing = true;
    if (this.pending) {
      const { startMs } = this.pending;
      this.pending = null;
      void this.start(this.trackId, startMs);
      return;
    }
    void this.player?.resume().catch(() => undefined);
  }

  pause() {
    this.playing = false;
    if (this.pending) return this.listener?.state(this, "paused");
    void this.player?.pause().catch(() => undefined);
  }

  stop() {
    const loaded = this.trackId !== null && this.pending === null;
    this.playing = false;
    this.trackId = null;
    this.pending = null;
    this.snapshot = null;
    this.stopPolling();
    if (loaded) void this.player?.pause().catch(() => undefined);
  }

  seek(ms: number) {
    const position = Math.max(0, Math.round(ms));
    if (this.snapshot) this.snapshot = { ...this.snapshot, position, at: performance.now() };
    this.nearEnd = false;
    if (this.pending) {
      this.pending.startMs = position;
      return;
    }
    void this.player?.seek(position).catch(() => undefined);
  }

  setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume));
    void this.player?.setVolume(this.volume).catch(() => undefined);
  }

  positionMs() {
    const s = this.snapshot;
    if (!s) return 0;
    const position = s.paused ? s.position : s.position + (performance.now() - s.at);
    const clamped = s.duration > 0 ? Math.min(position, s.duration) : position;
    // Remembered for end detection: the end is a pause at 0 right after being near the end.
    this.nearEnd = s.duration > 0 && s.duration - clamped < NEAR_END_MS;
    return clamped;
  }

  durationMs() {
    return this.snapshot?.duration ?? this.durationHint;
  }

  isPlaying() {
    return this.playing;
  }

  loadedId() {
    return this.trackId;
  }
}
