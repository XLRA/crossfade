import { describe, expect, it } from "vitest";

import { listenThresholdMs } from "./listen";

describe("listenThresholdMs", () => {
  it("counts a listen after 30 seconds of a normal-length track", () => {
    expect(listenThresholdMs(215_000)).toBe(30_000);
    expect(listenThresholdMs(60_000)).toBe(30_000);
  });

  it("needs half of a shorter track", () => {
    expect(listenThresholdMs(40_000)).toBe(20_000);
  });

  it("never goes under 5 seconds", () => {
    expect(listenThresholdMs(6_000)).toBe(5_000);
  });

  it("falls back to 30 seconds while the length is unknown", () => {
    expect(listenThresholdMs(0)).toBe(30_000);
    expect(listenThresholdMs(-1)).toBe(30_000);
  });
});
