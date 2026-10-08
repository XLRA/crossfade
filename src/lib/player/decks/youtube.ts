import { loadScript } from "../load-script";
import { type Deck, type DeckErrorKind, type DeckListener } from "./types";

/*
 * YouTube IFrame Player API deck. https://developers.google.com/youtube/iframe_api_reference
 * The API's types aren't bundled, so the few members we use are declared here.
 */

type YTPlayer = {
  loadVideoById(options: { videoId: string; startSeconds?: number }): void;
  cueVideoById(options: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  unMute(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
};

type YTNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      width?: string;
      height?: string;
      host?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: (event: { data: number }) => void;
      };
    },
  ) => YTPlayer;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

const ERRORS: Record<number, [DeckErrorKind, string]> = {
  2: ["not_found", "That YouTube video id isn't valid."],
  5: ["unsupported", "This video can't play in the browser."],
  100: ["not_found", "This video was removed or made private."],
  101: ["not_embeddable", "The uploader doesn't allow this video to play outside YouTube."],
  150: ["not_embeddable", "The uploader doesn't allow this video to play outside YouTube."],
};

let api: Promise<YTNamespace> | null = null;

function loadYouTubeApi(): Promise<YTNamespace> {
  api ??= new Promise<YTNamespace>((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    loadScript("https://www.youtube.com/iframe_api").catch((error: unknown) => {
      api = null;
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
  return api;
}

export class YouTubeDeck implements Deck {
  readonly kind = "youtube" as const;
  readonly canFade = true;
  listener: DeckListener | null = null;

  private player: YTPlayer | null = null;
  private ready: Promise<YTPlayer> | null = null;
  private videoId: string | null = null;
  private volume = 1;
  private playing = false;
  /** Set while we expect playback to start; cleared when it does. */
  private autoplayTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    readonly id: string,
    private readonly host: HTMLElement,
  ) {}

  /** The iframe is created on first use so pages that never play a video never load the API. */
  private player$(): Promise<YTPlayer> {
    this.ready ??= loadYouTubeApi().then(
      (YT) =>
        new Promise<YTPlayer>((resolve) => {
          const mount = document.createElement("div");
          this.host.replaceChildren(mount);
          const player = new YT.Player(mount, {
            width: "100%",
            height: "100%",
            host: "https://www.youtube.com",
            playerVars: {
              autoplay: 0,
              controls: 0,
              disablekb: 1,
              fs: 0,
              iv_load_policy: 3,
              playsinline: 1,
              rel: 0,
              enablejsapi: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: () => {
                this.player = player;
                resolve(player);
              },
              onStateChange: ({ data }) => this.onState(data),
              onError: ({ data }) => this.onError(data),
            },
          });
        }),
    );
    return this.ready;
  }

  private onState(state: number) {
    if (!this.videoId) return;
    switch (state) {
      case STATE.PLAYING:
        clearTimeout(this.autoplayTimer);
        this.playing = true;
        this.listener?.state(this, "playing");
        break;
      case STATE.PAUSED:
        this.playing = false;
        this.listener?.state(this, "paused");
        break;
      case STATE.BUFFERING:
        this.listener?.state(this, "buffering");
        break;
      case STATE.ENDED:
        this.playing = false;
        this.listener?.state(this, "ended");
        break;
    }
  }

  private onError(code: number) {
    clearTimeout(this.autoplayTimer);
    this.playing = false;
    const [kind, message] = ERRORS[code] ?? (["unsupported", "YouTube couldn't play this video."] as const);
    this.listener?.error(this, kind, message);
  }

  load(videoId: string, { autoplay, startMs, volume }: { autoplay: boolean; startMs: number; volume: number }) {
    this.videoId = videoId;
    this.volume = volume;
    this.playing = autoplay;
    clearTimeout(this.autoplayTimer);
    void this.player$()
      .then((player) => {
        if (this.videoId !== videoId) return;
        player.unMute();
        player.setVolume(Math.round(this.volume * 100));
        const options = { videoId, startSeconds: startMs / 1000 };
        if (autoplay) {
          player.loadVideoById(options);
          // Browsers block autoplay without a recent click. If the video hasn't started after a
          // few seconds, report it paused so the play button works as the click it needs.
          this.autoplayTimer = setTimeout(() => {
            if (this.videoId !== videoId) return;
            const state = player.getPlayerState();
            if (state === STATE.UNSTARTED || state === STATE.CUED) {
              this.playing = false;
              this.listener?.state(this, "paused");
            }
          }, 4_000);
        } else {
          player.cueVideoById(options);
        }
      })
      .catch(() => this.listener?.error(this, "network", "YouTube's player didn't load. Check your connection."));
  }

  play() {
    this.playing = true;
    this.player?.playVideo();
  }

  pause() {
    clearTimeout(this.autoplayTimer);
    this.playing = false;
    this.player?.pauseVideo();
  }

  stop() {
    clearTimeout(this.autoplayTimer);
    this.playing = false;
    this.videoId = null;
    this.player?.stopVideo();
  }

  seek(ms: number) {
    this.player?.seekTo(ms / 1000, true);
  }

  setVolume(volume: number) {
    this.volume = volume;
    this.player?.setVolume(Math.round(volume * 100));
  }

  positionMs() {
    return this.player && this.videoId ? this.player.getCurrentTime() * 1000 : 0;
  }

  durationMs() {
    return this.player && this.videoId ? this.player.getDuration() * 1000 : 0;
  }

  isPlaying() {
    return this.playing;
  }

  loadedId() {
    return this.videoId;
  }
}
