import { describe, expect, it } from "vitest";

import { coverImages, trackKey } from "./types";

describe("trackKey", () => {
  it("combines the platform and its id", () => {
    expect(trackKey({ source: "YOUTUBE", sourceId: "dQw4w9WgXcQ" })).toBe("YOUTUBE:dQw4w9WgXcQ");
    expect(trackKey({ source: "SPOTIFY", sourceId: "4uLU6hMCjMI75M1A2tKUQC" })).toBe("SPOTIFY:4uLU6hMCjMI75M1A2tKUQC");
  });
});

describe("coverImages", () => {
  it("uses the first artwork until there are four different ones", () => {
    expect(coverImages(["a.jpg", "b.jpg", "c.jpg"])).toEqual(["a.jpg"]);
    expect(coverImages(["a.jpg", "a.jpg", "b.jpg", "b.jpg", "c.jpg"])).toEqual(["a.jpg"]);
  });

  it("makes a mosaic of the first four different ones", () => {
    expect(coverImages(["a.jpg", "a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg"])).toEqual([
      "a.jpg",
      "b.jpg",
      "c.jpg",
      "d.jpg",
    ]);
  });

  it("skips tracks without artwork", () => {
    expect(coverImages([null, undefined, "a.jpg"])).toEqual(["a.jpg"]);
    expect(coverImages([null, null])).toEqual([]);
    expect(coverImages([])).toEqual([]);
  });
});
