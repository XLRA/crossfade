import { describe, expect, it } from "vitest";

import { type TrackData } from "~/lib/types";
import { interleave, resultTracks, type SearchResult } from "./search-results";

const make = (source: TrackData["source"], id: string): TrackData => ({
  source,
  sourceId: id,
  title: id,
  artist: "Artist",
  album: null,
  albumId: null,
  artworkUrl: null,
  durationMs: 1_000,
  explicit: false,
  isrc: null,
});
const yt = (id: string) => make("YOUTUBE", id);
const sp = (id: string) => make("SPOTIFY", id);
const ids = (list: TrackData[]) => list.map((t) => t.sourceId);

describe("interleave", () => {
  it("takes turns between the lists", () => {
    expect(ids(interleave([[yt("y1"), yt("y2"), yt("y3")], [sp("s1")]]))).toEqual(["y1", "s1", "y2", "y3"]);
  });

  it("handles empty input", () => {
    expect(interleave([])).toEqual([]);
    expect(interleave([[], []])).toEqual([]);
  });
});

describe("resultTracks", () => {
  const search = (youtube: TrackData[], spotify: TrackData[]): SearchResult => ({
    query: "daft punk",
    isLink: false,
    link: null,
    youtube: { status: "ok", tracks: youtube },
    spotify: { status: "ok", tracks: spotify },
  });

  it("leads with YouTube unless the listener can play full Spotify tracks", () => {
    const data = search([yt("y1"), yt("y2")], [sp("s1"), sp("s2")]);
    expect(ids(resultTracks(data))).toEqual(["y1", "s1", "y2", "s2"]);
    expect(ids(resultTracks(data, { spotifyFirst: true }))).toEqual(["s1", "y1", "s2", "y2"]);
  });

  it("returns the one track behind a pasted track link", () => {
    const data: SearchResult = {
      query: "https://youtu.be/dQw4w9WgXcQ",
      isLink: true,
      link: { kind: "track", track: yt("dQw4w9WgXcQ") },
      youtube: null,
      spotify: null,
    };
    expect(ids(resultTracks(data))).toEqual(["dQw4w9WgXcQ"]);
  });

  it("returns every track of a pasted album or playlist", () => {
    const data: SearchResult = {
      query: "spotify:album:4m2880jivSbbyEGAKfITCa",
      isLink: true,
      link: {
        kind: "collection",
        source: "SPOTIFY",
        type: "album",
        id: "4m2880jivSbbyEGAKfITCa",
        title: "Random Access Memories",
        subtitle: "Daft Punk",
        artworkUrl: null,
        tracks: [sp("s1"), sp("s2")],
        skipped: 0,
      },
      youtube: null,
      spotify: null,
    };
    expect(ids(resultTracks(data))).toEqual(["s1", "s2"]);
  });

  it("returns nothing for a link that can't be played or no data yet", () => {
    const data: SearchResult = {
      query: "https://youtu.be/xxxxxxxxxxx",
      isLink: true,
      link: { kind: "unavailable", source: "YOUTUBE", message: "This video is private." },
      youtube: null,
      spotify: null,
    };
    expect(resultTracks(data)).toEqual([]);
    expect(resultTracks(undefined)).toEqual([]);
  });
});
