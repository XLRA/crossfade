"use client";

import { shallow } from "zustand/shallow";

import { type PlayerState, usePlayer } from "./store";
import { type QueueItem } from "./types";

/*
 * Keeps settings and the last queue across reloads, in this browser only. Written by hand
 * rather than with zustand's persist middleware because that serializes the whole snapshot on
 * every state change, and the player updates its position four times a second.
 */

const KEY = "crossfade:player:v1";

type Saved = {
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: PlayerState["repeat"];
  crossfadeSeconds: number;
  panel: PlayerState["panel"];
  queue: {
    context: PlayerState["context"];
    original: QueueItem[];
    /** Play order as uids into `original`. */
    order: string[];
    index: number;
    upNext: QueueItem[];
    current: QueueItem | null;
    fromUpNext: boolean;
    positionMs: number;
  } | null;
};

function snapshot(state: PlayerState) {
  return {
    volume: state.volume,
    muted: state.muted,
    shuffle: state.shuffle,
    repeat: state.repeat,
    crossfadeSeconds: state.crossfadeSeconds,
    panel: state.panel,
    context: state.context,
    original: state.original,
    order: state.order,
    index: state.index,
    upNext: state.upNext,
    current: state.current,
    fromUpNext: state.fromUpNext,
  };
}

function write() {
  const state = usePlayer.getState();
  const saved: Saved = {
    volume: state.volume,
    muted: state.muted,
    shuffle: state.shuffle,
    repeat: state.repeat,
    crossfadeSeconds: state.crossfadeSeconds,
    panel: state.panel,
    queue: state.current
      ? {
          context: state.context,
          original: state.original,
          order: state.order.map((item) => item.uid),
          index: state.index,
          upNext: state.upNext,
          current: state.current,
          fromUpNext: state.fromUpNext,
          positionMs: Math.round(state.positionMs),
        }
      : null,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Private mode or full storage: the player still works, it just won't remember.
  }
}

const isItem = (value: unknown): value is QueueItem =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as QueueItem).uid === "string" &&
  typeof (value as QueueItem).track?.sourceId === "string" &&
  ((value as QueueItem).track.source === "YOUTUBE" || (value as QueueItem).track.source === "SPOTIFY");

/** Loads what the last visit left behind. The restored track waits, paused, for a press of play. */
export function restorePlayer() {
  let saved: Partial<Saved>;
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Saved>;
  } catch {
    return;
  }

  const settings: Partial<PlayerState> = {};
  if (typeof saved.volume === "number") settings.volume = Math.min(1, Math.max(0, saved.volume));
  if (typeof saved.muted === "boolean") settings.muted = saved.muted;
  if (typeof saved.shuffle === "boolean") settings.shuffle = saved.shuffle;
  if (saved.repeat === "off" || saved.repeat === "all" || saved.repeat === "one") settings.repeat = saved.repeat;
  if (typeof saved.crossfadeSeconds === "number") settings.crossfadeSeconds = saved.crossfadeSeconds;
  if (saved.panel === null || saved.panel === "nowPlaying" || saved.panel === "queue") settings.panel = saved.panel;

  const queue = saved.queue;
  if (queue && isItem(queue.current) && Array.isArray(queue.original) && queue.original.every(isItem)) {
    const byUid = new Map(queue.original.map((item) => [item.uid, item]));
    const order = Array.isArray(queue.order)
      ? queue.order.map((uid) => byUid.get(uid)).filter((item): item is QueueItem => Boolean(item))
      : queue.original;
    const upNext = Array.isArray(queue.upNext) ? queue.upNext.filter(isItem) : [];
    Object.assign(settings, {
      context: queue.context ?? null,
      original: queue.original,
      order: order.length === queue.original.length ? order : queue.original,
      index: Math.min(Math.max(-1, Number(queue.index) || 0), queue.original.length - 1),
      upNext,
      current: queue.current,
      fromUpNext: Boolean(queue.fromUpNext),
      positionMs: Math.max(0, Number(queue.positionMs) || 0),
      durationMs: queue.current.track.durationMs,
      status: "paused",
    } satisfies Partial<PlayerState>);
  }

  usePlayer.setState(settings);
}

/** Saves on changes (debounced), every few seconds while playing, and when the page goes away. */
export function startPersisting(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(write, 400);
  };

  const unsubscribe = usePlayer.subscribe(snapshot, schedule, { equalityFn: shallow });
  const interval = setInterval(() => {
    if (usePlayer.getState().status === "playing") write();
  }, 5_000);
  const onHide = () => {
    if (document.visibilityState === "hidden") write();
  };
  window.addEventListener("pagehide", write);
  document.addEventListener("visibilitychange", onHide);

  return () => {
    unsubscribe();
    clearTimeout(timer);
    clearInterval(interval);
    window.removeEventListener("pagehide", write);
    document.removeEventListener("visibilitychange", onHide);
  };
}
