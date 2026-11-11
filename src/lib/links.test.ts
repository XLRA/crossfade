import { describe, expect, it } from "vitest";

import { looksLikeLink, parseMusicLink, sourceUrl } from "./links";

const VIDEO = "dQw4w9WgXcQ";
const TRACK = "4uLU6hMCjMI75M1A2tKUQC";

describe("parseMusicLink", () => {
  it.each([
    `https://youtu.be/${VIDEO}`,
    `https://youtu.be/${VIDEO}?si=Wx8f2N1qY0`,
    `https://www.youtube.com/watch?v=${VIDEO}`,
    `https://www.youtube.com/watch?v=${VIDEO}&list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI&index=3`,
    `https://m.youtube.com/watch?v=${VIDEO}&t=42s`,
    `https://music.youtube.com/watch?v=${VIDEO}`,
    `youtube.com/watch?v=${VIDEO}`,
    `https://www.youtube.com/shorts/${VIDEO}`,
    `https://www.youtube.com/embed/${VIDEO}`,
    `https://www.youtube.com/live/${VIDEO}?feature=share`,
    `https://www.youtube-nocookie.com/embed/${VIDEO}`,
    `  https://youtu.be/${VIDEO}  `,
  ])("reads a YouTube video from %s", (link) => {
    expect(parseMusicLink(link)).toEqual({ source: "YOUTUBE", kind: "track", id: VIDEO });
  });

  it("reads a YouTube playlist", () => {
    expect(parseMusicLink("https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI")).toEqual({
      source: "YOUTUBE",
      kind: "playlist",
      id: "PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI",
    });
  });

  it.each([
    [`https://open.spotify.com/track/${TRACK}`, "track"],
    [`https://open.spotify.com/track/${TRACK}?si=1a2b3c4d5e6f`, "track"],
    [`https://open.spotify.com/intl-de/track/${TRACK}`, "track"],
    [`https://open.spotify.com/intl-pt-br/track/${TRACK}`, "track"],
    [`open.spotify.com/album/${TRACK}`, "album"],
    [`https://open.spotify.com/playlist/${TRACK}`, "playlist"],
    [`spotify:track:${TRACK}`, "track"],
    [`spotify:playlist:${TRACK}`, "playlist"],
  ])("reads a Spotify link from %s", (link, kind) => {
    expect(parseMusicLink(link)).toEqual({ source: "SPOTIFY", kind, id: TRACK });
  });

  it.each([
    "daft punk",
    "",
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/too-short",
    "https://www.youtube.com/@daftpunk",
    "https://www.youtube.com/watch?v=not-an-id",
    "https://open.spotify.com/artist/4tZwfgrHOc3mvqYlEYSvVi",
    "https://open.spotify.com/track/abc",
    "spotify:track:abc",
  ])("rejects %j", (input) => {
    expect(parseMusicLink(input)).toBeNull();
  });
});

describe("looksLikeLink", () => {
  it("spots links, with or without a scheme", () => {
    expect(looksLikeLink("https://anything.example")).toBe(true);
    expect(looksLikeLink(`youtu.be/${VIDEO}`)).toBe(true);
    expect(looksLikeLink(`music.youtube.com/watch?v=${VIDEO}`)).toBe(true);
    expect(looksLikeLink(`spotify:track:${TRACK}`)).toBe(true);
  });

  it("leaves ordinary searches alone", () => {
    expect(looksLikeLink("daft punk")).toBe(false);
    expect(looksLikeLink("youtube rewind")).toBe(false);
  });
});

describe("sourceUrl", () => {
  it("links each platform's own page", () => {
    expect(sourceUrl({ source: "YOUTUBE", sourceId: VIDEO })).toBe(`https://www.youtube.com/watch?v=${VIDEO}`);
    expect(sourceUrl({ source: "SPOTIFY", sourceId: TRACK })).toBe(`https://open.spotify.com/track/${TRACK}`);
  });
});
