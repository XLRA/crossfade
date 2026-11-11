import { describe, expect, it } from "vitest";

import { BASE_PATH, withBase } from "./base-path";

describe("withBase", () => {
  it("mounts app paths under /crossfade", () => {
    expect(BASE_PATH).toBe("/crossfade");
    expect(withBase("/search")).toBe("/crossfade/search");
    expect(withBase("api/covers/abc")).toBe("/crossfade/api/covers/abc");
    expect(withBase("/")).toBe("/crossfade");
  });

  it("leaves paths that already have the base alone", () => {
    expect(withBase("/crossfade")).toBe("/crossfade");
    expect(withBase("/crossfade/playlist/abc")).toBe("/crossfade/playlist/abc");
  });

  it("doesn't mistake a lookalike prefix for the base", () => {
    expect(withBase("/crossfader")).toBe("/crossfade/crossfader");
  });
});
