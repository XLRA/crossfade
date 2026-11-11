import { describe, expect, it, vi } from "vitest";

import { pickImage, type SpotifyTrackObject, toTrack } from "./spotify";

// The mapping is pure, but the module also holds the API client, which reads the environment and
// the response cache at import time.
vi.mock("~/env", () => ({ env: { SPOTIFY_MARKET: "US" } }));
vi.mock("~/server/cache", () => ({
  cached: vi.fn(),
  prime: vi.fn(),
  normalizeQuery: (q: string) => q,
}));

const images = [
  { url: "https://i.scdn.co/image/640", width: 640, height: 640 },
  { url: "https://i.scdn.co/image/300", width: 300, height: 300 },
  { url: "https://i.scdn.co/image/64", width: 64, height: 64 },
];

const oneMoreTime: SpotifyTrackObject = {
  id: "0DiWol3AO6WpXZgp0goxAV",
  type: "track",
  name: "One More Time",
  duration_ms: 320_357,
  explicit: false,
  is_playable: true,
  external_ids: { isrc: "GBDUW0000053" },
  artists: [{ id: "4tZwfgrHOc3mvqYlEYSvVi", name: "Daft Punk" }],
  album: { id: "2noRn2Aes5aoNVsU6iWThc", name: "Discovery", images },
};

describe("pickImage", () => {
  it("prefers the ~300px rendition", () => {
    expect(pickImage(images)).toBe("https://i.scdn.co/image/300");
  });

  it("falls back to the first image when there are no sizes", () => {
    expect(pickImage([{ url: "a" }, { url: "b" }])).toBe("a");
  });

  it("returns null without images", () => {
    expect(pickImage([])).toBeNull();
    expect(pickImage(null)).toBeNull();
    expect(pickImage(undefined)).toBeNull();
  });
});

describe("toTrack", () => {
  it("maps a Spotify track to a Crossfade track", () => {
    expect(toTrack(oneMoreTime)).toEqual({
      source: "SPOTIFY",
      sourceId: "0DiWol3AO6WpXZgp0goxAV",
      title: "One More Time",
      artist: "Daft Punk",
      album: "Discovery",
      albumId: "2noRn2Aes5aoNVsU6iWThc",
      artworkUrl: "https://i.scdn.co/image/300",
      durationMs: 320_357,
      explicit: false,
      isrc: "GBDUW0000053",
    });
  });

  it("joins featured artists", () => {
    const track = toTrack({
      ...oneMoreTime,
      artists: [
        { id: "1", name: "Daft Punk" },
        { id: "2", name: "Pharrell Williams" },
        { id: "3", name: "Nile Rodgers" },
      ],
    });
    expect(track?.artist).toBe("Daft Punk, Pharrell Williams, Nile Rodgers");
  });

  it("takes the album from the album response for album tracks", () => {
    const bare = { ...oneMoreTime, album: undefined };
    const track = toTrack(bare, { id: "2noRn2Aes5aoNVsU6iWThc", name: "Discovery", images });
    expect(track).toMatchObject({ album: "Discovery", albumId: "2noRn2Aes5aoNVsU6iWThc" });
    expect(track?.artworkUrl).toBe("https://i.scdn.co/image/300");
  });

  it("names an unknown artist rather than leaving it blank", () => {
    expect(toTrack({ ...oneMoreTime, artists: [] })?.artist).toBe("Unknown artist");
  });

  it("skips what can't be played: local files, episodes, region-locked and removed tracks", () => {
    expect(toTrack({ ...oneMoreTime, is_local: true })).toBeNull();
    expect(toTrack({ ...oneMoreTime, type: "episode" })).toBeNull();
    expect(toTrack({ ...oneMoreTime, is_playable: false })).toBeNull();
    expect(toTrack({ ...oneMoreTime, id: null })).toBeNull();
    expect(toTrack(null)).toBeNull();
  });
});
