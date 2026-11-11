import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clientIp, rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T15:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to the limit in a window, then refuses", () => {
    const allowed = Array.from({ length: 4 }, () => rateLimit("test:burst", 3, 60_000));
    expect(allowed).toEqual([true, true, true, false]);
  });

  it("lets requests through again as old ones leave the window", () => {
    expect(rateLimit("test:slide", 2, 10_000)).toBe(true);
    vi.advanceTimersByTime(6_000);
    expect(rateLimit("test:slide", 2, 10_000)).toBe(true);
    expect(rateLimit("test:slide", 2, 10_000)).toBe(false);

    // The first request is now more than ten seconds old; the second isn't.
    vi.advanceTimersByTime(4_500);
    expect(rateLimit("test:slide", 2, 10_000)).toBe(true);
    expect(rateLimit("test:slide", 2, 10_000)).toBe(false);
  });

  it("counts each key separately", () => {
    expect(rateLimit("test:a", 1, 60_000)).toBe(true);
    expect(rateLimit("test:b", 1, 60_000)).toBe(true);
    expect(rateLimit("test:a", 1, 60_000)).toBe(false);
  });
});

describe("clientIp", () => {
  it("prefers Cloudflare's header", () => {
    const headers = new Headers({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "10.0.0.1" });
    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("takes the first address in the proxy chain", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "198.51.100.4, 10.0.0.1" }))).toBe("198.51.100.4");
  });

  it("falls back to x-real-ip, then unknown", () => {
    expect(clientIp(new Headers({ "x-real-ip": "192.0.2.10" }))).toBe("192.0.2.10");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
