import { describe, expect, it, vi } from "vitest";

import { videoToTrack } from "./youtube";

// videoToTrack is pure; the rest of the module talks to the API and needs these.
vi.mock("~/env", () => ({ env: {} }));
vi.mock("~/server/cache", () => ({ cached: vi.fn(), normalizeQuery: (q: string) => q }));
vi.mock("~/server/quota", () => ({
  canSpendYouTube: vi.fn(),
  markQuotaExhausted: vi.fn(),
  spendQuota: vi.fn(),
}));

type Video = Parameters<typeof videoToTrack>[0];

const snippet = {
  title: "Daft Punk - One More Time (Official Video)",
  channelTitle: "Daft Punk",
  liveBroadcastContent: "none" as const,
};

const video: Video = {
  id: "FGBhQbmPwH8",
  snippet,
  contentDetails: { duration: "PT5M21S" },
  status: { embeddable: true, privacyStatus: "public" },
};

describe("videoToTrack", () => {
  it("maps a music video to a track", () => {
    expect(videoToTrack(video)).toEqual({
      source: "YOUTUBE",
      sourceId: "FGBhQbmPwH8",
      title: "One More Time",
      artist: "Daft Punk",
      album: null,
      albumId: null,
      artworkUrl: "https://i.ytimg.com/vi/FGBhQbmPwH8/mqdefault.jpg",
      durationMs: 321_000,
      explicit: false,
      isrc: null,
    });
  });

  it("marks age-restricted videos explicit", () => {
    const restricted = { duration: "PT3M", contentRating: { ytRating: "ytAgeRestricted" } };
    expect(videoToTrack({ ...video, contentDetails: restricted })?.explicit).toBe(true);
  });

  it("skips videos that can't play here", () => {
    // Private and deleted videos come back without a snippet.
    expect(videoToTrack({ id: "gone" })).toBeNull();
    expect(videoToTrack({ ...video, snippet: { ...snippet, liveBroadcastContent: "live" } })).toBeNull();
    expect(videoToTrack({ ...video, snippet: { ...snippet, liveBroadcastContent: "upcoming" } })).toBeNull();
    expect(videoToTrack({ ...video, status: { embeddable: false } })).toBeNull();
  });
});
