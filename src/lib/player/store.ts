"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import { type TrackData } from "~/lib/types";
import {
  advance,
  emptyQueue,
  enqueue,
  jumpTo,
  type QueueState,
  removeQueued,
  retreat,
  setShuffle,
  startContext,
} from "./queue";
import {
  type EngineKind,
  type PlaybackController,
  type PlaybackStatus,
  type PlayContext,
  type QueueItem,
  type RepeatMode,
  type SurfaceLayer,
} from "./types";

export type RightPanel = "nowPlaying" | "queue";

export type PlayerState = QueueState & {
  status: PlaybackStatus;
  buffering: boolean;
  positionMs: number;
  durationMs: number;
  /** Last playback problem, shown under the track title until something plays. */
  error: string | null;
  engine: EngineKind | null;
  surface: SurfaceLayer | null;

  volume: number;
  muted: boolean;
  crossfadeSeconds: number;
  panel: RightPanel | null;

  playTracks: (tracks: TrackData[], startIndex: number, context: PlayContext | null) => void;
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seek: (ms: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setCrossfade: (seconds: number) => void;
  addToQueue: (tracks: TrackData[]) => void;
  playNext: (tracks: TrackData[]) => void;
  removeFromQueue: (uid: string) => void;
  clearQueue: () => void;
  jumpTo: (uid: string) => void;
  togglePanel: (panel: RightPanel) => void;
  setPanel: (panel: RightPanel | null) => void;

  // Called by the playback controller.
  _status: (status: PlaybackStatus, buffering?: boolean) => void;
  _progress: (positionMs: number, durationMs: number) => void;
  _ended: () => void;
  _failed: (uid: string, message: string) => void;
  _advanceForCrossfade: () => QueueItem | null;
  _surface: (layer: SurfaceLayer | null, engine: EngineKind | null) => void;
};

let controller: PlaybackController | null = null;

export function registerController(next: PlaybackController | null) {
  controller = next;
}

const MAX_CONSECUTIVE_FAILURES = 5;
let failures = 0;
let skipTimer: ReturnType<typeof setTimeout> | undefined;

function queueOf(state: PlayerState): QueueState {
  return {
    context: state.context,
    original: state.original,
    order: state.order,
    index: state.index,
    upNext: state.upNext,
    current: state.current,
    fromUpNext: state.fromUpNext,
    shuffle: state.shuffle,
    repeat: state.repeat,
  };
}

/** Fresh-track fields: progress resets and the catalog duration shows until the player knows better. */
function startOf(item: QueueItem | null) {
  return { positionMs: 0, durationMs: item?.track.durationMs ?? 0, error: null };
}

export const usePlayer = create<PlayerState>()(
  subscribeWithSelector((set, get) => {
    function load(item: QueueItem | null, autoplay: boolean) {
      clearTimeout(skipTimer);
      if (!item) return;
      set({ status: autoplay ? "loading" : "paused", buffering: autoplay });
      controller?.load(item, { autoplay });
    }

    return {
      ...emptyQueue,
      status: "idle",
      buffering: false,
      positionMs: 0,
      durationMs: 0,
      error: null,
      engine: null,
      surface: null,
      volume: 0.8,
      muted: false,
      crossfadeSeconds: 5,
      panel: null,

      playTracks(tracks, startIndex, context) {
        const next = startContext(queueOf(get()), tracks, startIndex, context);
        if (!next.current) return;
        failures = 0;
        set({ ...next, ...startOf(next.current) });
        load(next.current, true);
      },

      togglePlay() {
        const { status } = get();
        if (status === "playing" || status === "loading") get().pause();
        else get().play();
      },

      play() {
        const { current, positionMs } = get();
        if (!current) return;
        if (controller?.holds(current)) {
          controller.play();
          set({ status: "playing" });
        } else {
          set({ status: "loading", buffering: true });
          controller?.load(current, { autoplay: true, startMs: positionMs });
        }
      },

      pause() {
        clearTimeout(skipTimer);
        controller?.pause();
        set({ status: "paused", buffering: false });
      },

      next() {
        const { state, ended } = advance(queueOf(get()), { auto: false });
        failures = 0;
        set({ ...state, ...startOf(state.current) });
        load(state.current, !ended);
      },

      previous() {
        if (get().positionMs > 3_000) {
          get().seek(0);
          return;
        }
        const state = retreat(queueOf(get()));
        if (!state) {
          get().seek(0);
          return;
        }
        failures = 0;
        set({ ...state, ...startOf(state.current) });
        load(state.current, true);
      },

      seek(ms) {
        const { durationMs } = get();
        const target = Math.max(0, durationMs > 0 ? Math.min(ms, durationMs - 250) : ms);
        set({ positionMs: target });
        controller?.seek(target);
      },

      setVolume(volume) {
        set({ volume: Math.min(1, Math.max(0, volume)), muted: false });
        controller?.applyVolume();
      },

      toggleMute() {
        const { muted, volume } = get();
        if (muted || volume === 0) set({ muted: false, volume: volume === 0 ? 0.5 : volume });
        else set({ muted: true });
        controller?.applyVolume();
      },

      toggleShuffle() {
        set(setShuffle(queueOf(get()), !get().shuffle));
      },

      cycleRepeat() {
        const order: RepeatMode[] = ["off", "all", "one"];
        set({ repeat: order[(order.indexOf(get().repeat) + 1) % order.length] });
      },

      setCrossfade(seconds) {
        set({ crossfadeSeconds: Math.min(12, Math.max(0, Math.round(seconds))) });
      },

      addToQueue(tracks) {
        const hadNothing = !get().current;
        const state = enqueue(queueOf(get()), tracks, { next: false });
        set(state);
        // With nothing loaded, queueing a track should start it rather than leave it waiting.
        if (hadNothing) get().next();
      },

      playNext(tracks) {
        const hadNothing = !get().current;
        set(enqueue(queueOf(get()), tracks, { next: true }));
        if (hadNothing) get().next();
      },

      removeFromQueue(uid) {
        set(removeQueued(queueOf(get()), uid));
      },

      clearQueue() {
        set({ upNext: [] });
      },

      jumpTo(uid) {
        const state = jumpTo(queueOf(get()), uid);
        if (!state) return;
        failures = 0;
        set({ ...state, ...startOf(state.current) });
        load(state.current, true);
      },

      togglePanel(panel) {
        set({ panel: get().panel === panel ? null : panel });
      },

      setPanel(panel) {
        set({ panel });
      },

      _status(status, buffering = false) {
        if (status === "playing") failures = 0;
        set(status === "playing" ? { status, buffering, error: null } : { status, buffering });
      },

      _progress(positionMs, durationMs) {
        const prev = get();
        const duration = durationMs > 0 ? durationMs : prev.durationMs;
        if (Math.abs(prev.positionMs - positionMs) < 200 && prev.durationMs === duration) return;
        set({ positionMs, durationMs: duration });
      },

      _ended() {
        const { repeat, current } = get();
        if (repeat === "one" && current) {
          controller?.seek(0);
          controller?.play();
          return;
        }
        const { state, ended } = advance(queueOf(get()), { auto: true });
        set({ ...state, ...startOf(state.current) });
        if (ended && state.current === current) {
          controller?.pause();
          controller?.seek(0);
          set({ status: "paused", buffering: false });
          return;
        }
        load(state.current, !ended);
      },

      _failed(uid, message) {
        const { current } = get();
        if (current?.uid !== uid) return;
        failures += 1;
        set({ error: message, buffering: false });
        const { state } = advance(queueOf(get()), { auto: false });
        const canSkip = failures < MAX_CONSECUTIVE_FAILURES && state.current && state.current.uid !== uid;
        if (!canSkip) {
          set({ status: "paused" });
          return;
        }
        // Give people a moment to see what happened, then move on like Spotify does with
        // unavailable tracks.
        clearTimeout(skipTimer);
        skipTimer = setTimeout(() => {
          if (get().current?.uid !== uid) return;
          const { state: moved, ended } = advance(queueOf(get()), { auto: false });
          set({ ...moved, ...startOf(moved.current), error: message });
          load(moved.current, !ended);
        }, 1_800);
      },

      _advanceForCrossfade() {
        const { state, ended } = advance(queueOf(get()), { auto: true });
        if (ended || !state.current || state.current === get().current) return null;
        set({ ...state, ...startOf(state.current), status: "playing" });
        return state.current;
      },

      _surface(surface, engine) {
        set({ surface, engine });
      },
    };
  }),
);

/** Volume as the players should apply it, 0–1. */
export function effectiveVolume(state: Pick<PlayerState, "volume" | "muted">): number {
  return state.muted ? 0 : state.volume;
}
