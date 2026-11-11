import { describe, expect, it } from "vitest";

import { coverUrl, isJpeg, playlistCovers } from "./covers";

/** A byte array of `length` with the given bytes at the start and end. */
function bytes(length: number, start: number[], end: number[]): Uint8Array {
  const out = new Uint8Array(length);
  out.set(start, 0);
  out.set(end, length - end.length);
  return out;
}

describe("isJpeg", () => {
  it("accepts a complete JPEG", () => {
    expect(isJpeg(bytes(4_096, [0xff, 0xd8, 0xff, 0xe0], [0xff, 0xd9]))).toBe(true);
  });

  it("rejects other formats", () => {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    expect(isJpeg(bytes(4_096, png, [0xae, 0x42, 0x60, 0x82]))).toBe(false);
  });

  it("rejects a truncated upload", () => {
    expect(isJpeg(bytes(4_096, [0xff, 0xd8, 0xff, 0xe0], [0x00, 0x00]))).toBe(false);
  });

  it("rejects anything too small to be an image", () => {
    expect(isJpeg(bytes(64, [0xff, 0xd8, 0xff], [0xff, 0xd9]))).toBe(false);
  });
});

describe("coverUrl", () => {
  it("serves covers under the base path with a version that changes on upload", () => {
    const first = coverUrl("cm1", new Date("2026-11-07T20:46:05Z"));
    const second = coverUrl("cm1", new Date("2026-11-07T20:50:00Z"));
    expect(first).toMatch(/^\/crossfade\/api\/covers\/cm1\?v=[0-9a-z]+$/);
    expect(second).not.toBe(first);
  });
});

describe("playlistCovers", () => {
  const artwork = ["a.jpg", "b.jpg", "c.jpg", "d.jpg"];

  it("uses the uploaded cover on its own", () => {
    const updatedAt = new Date("2026-11-07T20:46:05Z");
    expect(playlistCovers({ id: "cm1", coverUpdatedAt: updatedAt }, artwork)).toEqual([coverUrl("cm1", updatedAt)]);
  });

  it("falls back to the track artwork", () => {
    expect(playlistCovers({ id: "cm1", coverUpdatedAt: null }, artwork)).toEqual(artwork);
    expect(playlistCovers({ id: "cm1", coverUpdatedAt: null }, [])).toEqual([]);
  });
});
