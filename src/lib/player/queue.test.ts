import { describe, expect, it } from "vitest";

import { type TrackData } from "~/lib/types";
import {
  advance,
  emptyQueue,
  enqueue,
  jumpTo,
  peekNext,
  type QueueState,
  remainingInContext,
  removeQueued,
  retreat,
  setShuffle,
  shuffled,
  startContext,
} from "./queue";

const track = (id: string): TrackData => ({
  source: "YOUTUBE",
  sourceId: id,
  title: `Track ${id}`,
  artist: "Artist",
  album: null,
  albumId: null,
  artworkUrl: null,
  durationMs: 180_000,
  explicit: false,
  isrc: null,
});

const tracks = (...ids: string[]) => ids.map(track);
const ids = (items: { track: TrackData }[]) => items.map((item) => item.track.sourceId);
const currentId = (state: QueueState) => state.current?.track.sourceId;

/** Plays a context of five tracks, a to e, starting at `start`. */
function playing(start = 0, overrides: Partial<QueueState> = {}): QueueState {
  return startContext({ ...emptyQueue, ...overrides }, tracks("a", "b", "c", "d", "e"), start, {
    type: "playlist",
    title: "Test",
  });
}

/** Deterministic stand-in for Math.random: walks through the given values in a loop. */
function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("startContext", () => {
  it("starts at the requested track", () => {
    const state = playing(2);
    expect(currentId(state)).toBe("c");
    expect(state.index).toBe(2);
    expect(ids(state.order)).toEqual(["a", "b", "c", "d", "e"]);
    expect(state.fromUpNext).toBe(false);
  });

  it("clamps the start index into range", () => {
    expect(currentId(playing(-3))).toBe("a");
    expect(currentId(playing(99))).toBe("e");
  });

  it("ignores an empty list", () => {
    const state = playing(1);
    expect(startContext(state, [], 0, null)).toBe(state);
  });

  it("keeps the queued tracks when a new context starts", () => {
    const queued = enqueue(playing(), tracks("q"), { next: false });
    const next = startContext(queued, tracks("x", "y"), 0, null);
    expect(ids(next.upNext)).toEqual(["q"]);
    expect(currentId(next)).toBe("x");
  });

  it("with shuffle on, plays the chosen track first and shuffles the rest", () => {
    const state = startContext({ ...emptyQueue, shuffle: true }, tracks("a", "b", "c", "d"), 2, null, sequence(0));
    expect(currentId(state)).toBe("c");
    expect(state.index).toBe(0);
    expect(ids(state.order)[0]).toBe("c");
    expect([...ids(state.order)].sort()).toEqual(["a", "b", "c", "d"]);
    expect(ids(state.original)).toEqual(["a", "b", "c", "d"]);
  });

  it("gives duplicate tracks their own queue entries", () => {
    const state = startContext(emptyQueue, tracks("a", "a"), 0, null);
    expect(state.order[0]!.uid).not.toBe(state.order[1]!.uid);
  });
});

describe("shuffled", () => {
  it("returns a permutation and leaves the input alone", () => {
    const input = ["a", "b", "c", "d", "e"];
    const out = shuffled(input, sequence(0.9, 0.1, 0.5, 0.3));
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("is a Fisher–Yates shuffle driven by the random source", () => {
    // random() = 0 always swaps the last unshuffled item with the first, rotating the list left.
    expect(shuffled(["a", "b", "c", "d"], () => 0)).toEqual(["b", "c", "d", "a"]);
  });
});

describe("advance and peekNext", () => {
  it("moves through the context in order", () => {
    let state = playing();
    for (const expected of ["b", "c", "d", "e"]) {
      expect(peekNext(state, { auto: true })?.track.sourceId).toBe(expected);
      const result = advance(state, { auto: true });
      expect(result.ended).toBe(false);
      state = result.state;
      expect(currentId(state)).toBe(expected);
    }
  });

  it("parks on the first track, ended, after the last one", () => {
    const last = playing(4);
    expect(peekNext(last, { auto: true })).toBeNull();
    const { state, ended } = advance(last, { auto: true });
    expect(ended).toBe(true);
    expect(currentId(state)).toBe("a");
    expect(state.index).toBe(0);
  });

  it("wraps around with repeat all", () => {
    const last = playing(4, { repeat: "all" });
    expect(peekNext(last, { auto: true })?.track.sourceId).toBe("a");
    const { state, ended } = advance(last, { auto: true });
    expect(ended).toBe(false);
    expect(currentId(state)).toBe("a");
  });

  it("repeats one track when it runs out, but not when the user skips", () => {
    const state = playing(1, { repeat: "one" });
    expect(peekNext(state, { auto: true })).toBe(state.current);
    expect(advance(state, { auto: true }).state).toBe(state);
    expect(peekNext(state, { auto: false })?.track.sourceId).toBe("c");
    expect(currentId(advance(state, { auto: false }).state)).toBe("c");
  });

  it("plays queued tracks before the context, then picks the context back up", () => {
    let state = enqueue(playing(1), tracks("q1", "q2"), { next: false });
    expect(peekNext(state, { auto: true })?.track.sourceId).toBe("q1");

    state = advance(state, { auto: true }).state;
    expect(currentId(state)).toBe("q1");
    expect(state.fromUpNext).toBe(true);
    expect(state.index).toBe(1);

    state = advance(state, { auto: true }).state;
    expect(currentId(state)).toBe("q2");
    state = advance(state, { auto: true }).state;
    expect(currentId(state)).toBe("c");
    expect(state.fromUpNext).toBe(false);
  });

  it("does nothing on an empty queue", () => {
    const result = advance(emptyQueue, { auto: false });
    expect(result.ended).toBe(true);
    expect(result.state).toBe(emptyQueue);
    expect(peekNext(emptyQueue, { auto: true })).toBeNull();
  });
});

describe("retreat", () => {
  it("goes back one track", () => {
    const state = retreat(playing(2));
    expect(currentId(state!)).toBe("b");
    expect(state!.index).toBe(1);
  });

  it("asks the caller to restart the track at the start of the list", () => {
    expect(retreat(playing(0))).toBeNull();
  });

  it("wraps to the last track with repeat all", () => {
    expect(currentId(retreat(playing(0, { repeat: "all" }))!)).toBe("e");
  });

  it("returns from a queued track to the context track before it", () => {
    let state = enqueue(playing(1), tracks("q"), { next: false });
    state = advance(state, { auto: false }).state;
    expect(currentId(state)).toBe("q");
    const back = retreat(state);
    expect(currentId(back!)).toBe("b");
    expect(back!.fromUpNext).toBe(false);
  });
});

describe("jumpTo", () => {
  it("jumps to a context track", () => {
    const state = playing();
    const target = state.order[3]!;
    const jumped = jumpTo(state, target.uid);
    expect(currentId(jumped!)).toBe("d");
    expect(jumped!.index).toBe(3);
  });

  it("drops the queued tracks ahead of the one picked", () => {
    const state = enqueue(playing(), tracks("q1", "q2", "q3"), { next: false });
    const jumped = jumpTo(state, state.upNext[1]!.uid);
    expect(currentId(jumped!)).toBe("q2");
    expect(jumped!.fromUpNext).toBe(true);
    expect(ids(jumped!.upNext)).toEqual(["q3"]);
  });

  it("returns null for an entry that isn't there", () => {
    expect(jumpTo(playing(), "missing")).toBeNull();
  });
});

describe("setShuffle", () => {
  it("keeps the playing track and shuffles everything after it", () => {
    const state = setShuffle(playing(2), true, sequence(0.7, 0.2, 0.4));
    expect(state.shuffle).toBe(true);
    expect(state.index).toBe(0);
    expect(ids(state.order)[0]).toBe("c");
    expect([...ids(state.order)].sort()).toEqual(["a", "b", "c", "d", "e"]);
    expect(remainingInContext(state)).toHaveLength(4);
  });

  it("returns to the real order at the same track", () => {
    const shuffledState = setShuffle(playing(2), true, sequence(0.7, 0.2, 0.4));
    const moved = advance(shuffledState, { auto: false }).state;
    const playingNow = currentId(moved)!;

    const unshuffled = setShuffle(moved, false);
    expect(unshuffled.shuffle).toBe(false);
    expect(ids(unshuffled.order)).toEqual(["a", "b", "c", "d", "e"]);
    expect(ids(unshuffled.order)[unshuffled.index]).toBe(playingNow);
  });

  it("returns the same state when nothing changes", () => {
    const state = playing();
    expect(setShuffle(state, false)).toBe(state);
  });
});

describe("enqueue and removeQueued", () => {
  it("adds to the end of the queue, or to the front with play next", () => {
    let state = enqueue(playing(), tracks("q1"), { next: false });
    state = enqueue(state, tracks("q2"), { next: false });
    state = enqueue(state, tracks("n"), { next: true });
    expect(ids(state.upNext)).toEqual(["n", "q1", "q2"]);
  });

  it("removes one queued entry by uid", () => {
    const state = enqueue(playing(), tracks("q1", "q2"), { next: false });
    expect(ids(removeQueued(state, state.upNext[0]!.uid).upNext)).toEqual(["q2"]);
  });
});

describe("remainingInContext", () => {
  it("lists the context tracks still to come", () => {
    expect(ids(remainingInContext(playing(2)))).toEqual(["d", "e"]);
    expect(remainingInContext(playing(4))).toEqual([]);
  });
});
