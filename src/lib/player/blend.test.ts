import { describe, expect, it } from "vitest";

import { type TrackData } from "~/lib/types";
import { continuesAlbum, equalPower } from "./blend";

describe("equalPower", () => {
  it("starts with only the outgoing track and ends with only the incoming one", () => {
    expect(equalPower(0)).toEqual({ outgoing: 1, incoming: 0 });
    const end = equalPower(1);
    expect(end.outgoing).toBeCloseTo(0, 10);
    expect(end.incoming).toBeCloseTo(1, 10);
  });

  it("keeps the combined power constant, so the middle doesn't dip", () => {
    for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const { outgoing, incoming } = equalPower(t);
      expect(outgoing ** 2 + incoming ** 2).toBeCloseTo(1, 10);
    }
    // Halfway, each track is at -3 dB rather than the -6 dB of a linear fade.
    expect(equalPower(0.5).outgoing).toBeCloseTo(Math.SQRT1_2, 10);
  });

  it("clamps points outside the blend", () => {
    expect(equalPower(-0.5)).toEqual(equalPower(0));
    expect(equalPower(3)).toEqual(equalPower(1));
  });
});

describe("continuesAlbum", () => {
  const song = (overrides: Partial<TrackData>): TrackData => ({
    source: "SPOTIFY",
    sourceId: "id",
    title: "Song",
    artist: "Daft Punk",
    album: "Alive 2007",
    albumId: "album",
    artworkUrl: null,
    durationMs: 200_000,
    explicit: false,
    isrc: null,
    ...overrides,
  });

  it("is true for the next track on the same album", () => {
    expect(continuesAlbum(song({}), song({ title: "Next", album: " alive 2007 " }))).toBe(true);
  });

  it("is false across albums, artists or platforms", () => {
    expect(continuesAlbum(song({}), song({ album: "Discovery" }))).toBe(false);
    expect(continuesAlbum(song({}), song({ artist: "Justice" }))).toBe(false);
    expect(continuesAlbum(song({}), song({ source: "YOUTUBE" }))).toBe(false);
  });

  it("is false when either track has no album, as YouTube videos don't", () => {
    expect(continuesAlbum(song({ album: null }), song({ album: null }))).toBe(false);
  });
});
