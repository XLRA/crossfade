import { loadScript } from "../load-script";
import { type Deck, type DeckListener, type DeckLoadOptions } from "./types";

/*
 * Spotify embed deck, for everyone the Web Playback SDK can't serve: guests, free accounts and
 * browsers without DRM support. https://developer.spotify.com/documentation/embeds/references/iframe-api
 *
 * The embed plays full tracks when the listener is signed in to Spotify in this browser, and
 * 30-second previews otherwise. It has no volume control, so it can't be faded; the controller
 * hands over to and from it without a blend.
 */

type PlaybackUpdate = { isPaused: boolean; isBuffering: boolean; duration: number; position: number };

type EmbedController = {
  loadUri(uri: string): void;
  play(): void;
  pause(): void;
  resume(): void;
  seek(seconds: number): void;
  destroy(): void;
  addListener(event: "ready", callback: () => void): void;
  addListener(event: "playback_update", callback: (event: { data: PlaybackUpdate }) => void): void;
};

type IFrameApi = {
  createController(
    element: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number },
    callback: (controller: EmbedController) => void,
  ): void;
};

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: IFrameApi) => void;
  }
}

let api: Promise<IFrameApi> | null = null;

function loadEmbedApi(): Promise<IFrameApi> {
  api ??= new Promise<IFrameApi>((resolve, reject) => {
    window.onSpotifyIframeApiReady = (iframeApi) => resolve(iframeApi);
    loadScript("https://open.spotify.com/embed/iframe-api/v1").catch((error: unknown) => {
      api = null;
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
  return api;
}

/** When to nudge a freshly loaded track with play() again, in ms after loading it. */
const PLAY_RETRIES = [400, 1_200, 2_500];
/** No playback by then: the browser blocked it, and the play button has to start it. */
const AUTOPLAY_GIVE_UP_MS = 5_000;

export class SpotifyEmbedDeck implements Deck {
  readonly id = "spotify-embed";
  readonly kind = "spotify-embed" as const;
  readonly canFade = false;
  listener: DeckListener | null = null;

  private controller: Promise<EmbedController> | null = null;
  private trackId: string | null = null;
  private playing = false;
  /** Whether the embed has reported playback of the current track yet. */
  private started = false;
  private startAtMs = 0;
  private durationHint = 0;
  private last: (PlaybackUpdate & { at: number }) | null = null;
  private endedFor: string | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(private readonly host: HTMLElement) {}

  /** The iframe is created with the first track (the API needs a URI up front). */
  private controller$(uri: string): Promise<EmbedController> {
    this.controller ??= loadEmbedApi().then(
      (iframeApi) =>
        new Promise<EmbedController>((resolve) => {
          const mount = document.createElement("div");
          this.host.replaceChildren(mount);
          iframeApi.createController(mount, { uri, width: "100%", height: "100%" }, (controller) => {
            controller.addListener("playback_update", ({ data }) => this.onUpdate(data));
            controller.addListener("ready", () => resolve(controller));
          });
        }),
    );
    return this.controller;
  }

  private clearTimers() {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
  }

  private onUpdate(data: PlaybackUpdate) {
    if (!this.trackId) return;
    this.last = { ...data, at: performance.now() };

    if (!data.isPaused && !this.started) {
      this.started = true;
      this.clearTimers();
      // The embed always starts from the top; restore a saved position once it's going.
      if (this.startAtMs > 1_000) this.seek(this.startAtMs);
    }

    const duration = data.duration || this.durationHint;
    const atEnd = duration > 0 && data.position >= duration - 1_200;
    if (data.isPaused && this.started && atEnd) {
      if (this.endedFor === this.trackId) return;
      this.endedFor = this.trackId;
      this.playing = false;
      this.listener?.state(this, "ended");
      return;
    }

    if (data.isBuffering && !data.isPaused) {
      this.listener?.state(this, "buffering");
    } else if (data.isPaused) {
      // Ignore the paused updates a fresh load sends before it starts playing.
      if (!this.started && this.playing) return;
      this.playing = false;
      this.listener?.state(this, "paused");
    } else {
      this.playing = true;
      this.listener?.state(this, "playing");
    }
  }

  load(trackId: string, { autoplay, startMs, durationMs = 0 }: DeckLoadOptions) {
    const uri = `spotify:track:${trackId}`;
    const firstLoad = this.controller === null;
    this.clearTimers();
    this.trackId = trackId;
    this.playing = autoplay;
    this.started = false;
    this.startAtMs = startMs;
    this.durationHint = durationMs;
    this.last = null;
    this.endedFor = null;

    void this.controller$(uri)
      .then((controller) => {
        if (this.trackId !== trackId) return;
        if (!firstLoad) controller.loadUri(uri);
        if (!autoplay) return;
        this.listener?.state(this, "buffering");
        // A freshly loaded embed can drop a play() that comes too early, so ask a few times.
        controller.play();
        for (const delay of PLAY_RETRIES) {
          this.timers.push(
            setTimeout(() => {
              if (this.trackId === trackId && this.playing && !this.started) controller.play();
            }, delay),
          );
        }
        this.timers.push(
          setTimeout(() => {
            if (this.trackId !== trackId || this.started) return;
            this.playing = false;
            this.listener?.state(this, "paused");
          }, AUTOPLAY_GIVE_UP_MS),
        );
      })
      .catch(() => this.listener?.error(this, "network", "Spotify's player didn't load. Check your connection."));
  }

  play() {
    if (!this.trackId) return;
    this.playing = true;
    void this.controller?.then((controller) => (this.started ? controller.resume() : controller.play()));
  }

  pause() {
    this.clearTimers();
    this.playing = false;
    void this.controller?.then((controller) => controller.pause());
  }

  stop() {
    this.clearTimers();
    const loaded = this.trackId !== null;
    this.trackId = null;
    this.playing = false;
    this.started = false;
    this.last = null;
    if (loaded) void this.controller?.then((controller) => controller.pause());
  }

  seek(ms: number) {
    if (!this.started) {
      this.startAtMs = ms;
      return;
    }
    if (this.last) this.last = { ...this.last, position: ms, at: performance.now() };
    void this.controller?.then((controller) => controller.seek(ms / 1000));
  }

  setVolume() {
    // The embed has no volume control; its own player UI sets the level.
  }

  positionMs() {
    const last = this.last;
    if (!last) return this.startAtMs;
    const position = last.isPaused ? last.position : last.position + (performance.now() - last.at);
    const duration = this.durationMs();
    return duration > 0 ? Math.min(position, duration) : position;
  }

  durationMs() {
    // Previews report their own (30 second) length; before any update, use the catalog's.
    const reported = this.last?.duration ?? 0;
    return reported > 0 ? reported : this.durationHint;
  }

  isPlaying() {
    return this.playing;
  }

  loadedId() {
    return this.trackId;
  }
}
