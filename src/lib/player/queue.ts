import { type TrackData } from "~/lib/types";
import { type PlayContext, type QueueItem, type RepeatMode } from "./types";

/*
 * The queue as plain data plus pure transitions, so the rules for next/previous/shuffle/repeat
 * can be tested without a browser.
 *
 * - `original` is the context (playlist, search results, …) in its real order.
 * - `order` is the play order: `original`, or a shuffled copy of it.
 * - `index` points into `order` at the context track that played last. Queue items ("Add to
 *   queue") don't move it, so the context picks up where it left off once they're done.
 * - `upNext` holds queued items. They play before the context continues.
 */
export type QueueState = {
  context: PlayContext | null;
  original: QueueItem[];
  order: QueueItem[];
  index: number;
  upNext: QueueItem[];
  current: QueueItem | null;
  /** True when `current` came from `upNext` rather than the context. */
  fromUpNext: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
};

export const emptyQueue: QueueState = {
  context: null,
  original: [],
  order: [],
  index: -1,
  upNext: [],
  current: null,
  fromUpNext: false,
  shuffle: false,
  repeat: "off",
};

let counter = 0;

export function makeItem(track: TrackData): QueueItem {
  counter = (counter + 1) % 1_000_000;
  return {
    uid: `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    track,
  };
}

/** Fisher–Yates. `random` is injectable for tests. */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Replaces the context and starts at `startIndex`. Queued items survive, as on Spotify. */
export function startContext(
  state: QueueState,
  tracks: TrackData[],
  startIndex: number,
  context: PlayContext | null,
  random?: () => number,
): QueueState {
  const items = tracks.map(makeItem);
  if (items.length === 0) return state;
  const start = Math.min(Math.max(startIndex, 0), items.length - 1);
  const first = items[start]!;
  const order = state.shuffle
    ? [
        first,
        ...shuffled(
          items.filter((_, i) => i !== start),
          random,
        ),
      ]
    : items;
  const index = state.shuffle ? 0 : start;
  return { ...state, context, original: items, order, index, current: order[index]!, fromUpNext: false };
}

/**
 * What would play next, without changing anything. With `auto` (the track ran out rather than
 * the user pressing next) repeat-one means the same item again.
 */
export function peekNext(state: QueueState, { auto }: { auto: boolean }): QueueItem | null {
  if (auto && state.repeat === "one" && state.current) return state.current;
  if (state.upNext.length > 0) return state.upNext[0]!;
  if (state.index + 1 < state.order.length) return state.order[state.index + 1]!;
  if (state.repeat === "all" && state.order.length > 0) return state.order[0]!;
  return null;
}

/**
 * Moves to the next item. `ended` means the list ran out: the player parks on the first track of
 * the context, paused, like Spotify does.
 */
export function advance(state: QueueState, { auto }: { auto: boolean }): { state: QueueState; ended: boolean } {
  if (auto && state.repeat === "one" && state.current) return { state, ended: false };

  if (state.upNext.length > 0) {
    const [head, ...rest] = state.upNext;
    return { state: { ...state, upNext: rest, current: head!, fromUpNext: true }, ended: false };
  }
  if (state.index + 1 < state.order.length) {
    const index = state.index + 1;
    return { state: { ...state, index, current: state.order[index]!, fromUpNext: false }, ended: false };
  }
  if (state.repeat === "all" && state.order.length > 0) {
    return { state: { ...state, index: 0, current: state.order[0]!, fromUpNext: false }, ended: false };
  }
  if (state.order.length > 0) {
    return { state: { ...state, index: 0, current: state.order[0]!, fromUpNext: false }, ended: true };
  }
  return { state, ended: true };
}

/** Moves back one item, or returns null when the caller should restart the current one. */
export function retreat(state: QueueState): QueueState | null {
  if (state.fromUpNext) {
    const previous = state.order[state.index];
    return previous ? { ...state, current: previous, fromUpNext: false } : null;
  }
  if (state.index > 0) {
    const index = state.index - 1;
    return { ...state, index, current: state.order[index]!, fromUpNext: false };
  }
  if (state.repeat === "all" && state.order.length > 1) {
    const index = state.order.length - 1;
    return { ...state, index, current: state.order[index]!, fromUpNext: false };
  }
  return null;
}

/** Plays a specific item from the queue panel. Queued items before it are dropped. */
export function jumpTo(state: QueueState, uid: string): QueueState | null {
  const queued = state.upNext.findIndex((item) => item.uid === uid);
  if (queued >= 0) {
    return {
      ...state,
      upNext: state.upNext.slice(queued + 1),
      current: state.upNext[queued]!,
      fromUpNext: true,
    };
  }
  const inOrder = state.order.findIndex((item) => item.uid === uid);
  if (inOrder >= 0) {
    return { ...state, index: inOrder, current: state.order[inOrder]!, fromUpNext: false };
  }
  return null;
}

/**
 * Shuffling keeps the context track that's playing (or last played) where it is and shuffles the
 * rest after it; unshuffling returns to the real order at that same track.
 */
export function setShuffle(state: QueueState, on: boolean, random?: () => number): QueueState {
  if (on === state.shuffle) return state;
  const anchor = state.index >= 0 ? state.order[state.index] : undefined;
  if (on) {
    const rest = state.original.filter((item) => item.uid !== anchor?.uid);
    const order = anchor ? [anchor, ...shuffled(rest, random)] : shuffled(state.original, random);
    return { ...state, shuffle: true, order, index: anchor ? 0 : -1 };
  }
  const index = anchor ? state.original.findIndex((item) => item.uid === anchor.uid) : -1;
  return { ...state, shuffle: false, order: state.original, index };
}

export function enqueue(state: QueueState, tracks: TrackData[], { next }: { next: boolean }): QueueState {
  const items = tracks.map(makeItem);
  return { ...state, upNext: next ? [...items, ...state.upNext] : [...state.upNext, ...items] };
}

export function removeQueued(state: QueueState, uid: string): QueueState {
  return { ...state, upNext: state.upNext.filter((item) => item.uid !== uid) };
}

/** The context tracks still to come, in play order. */
export function remainingInContext(state: Pick<QueueState, "order" | "index">): QueueItem[] {
  return state.order.slice(state.index + 1);
}
