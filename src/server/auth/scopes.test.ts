import { describe, expect, it } from "vitest";

import { hasScope, YOUTUBE_READONLY_SCOPE } from "./scopes";

describe("hasScope", () => {
  it("finds a scope in a space-separated grant", () => {
    const granted = `openid email profile ${YOUTUBE_READONLY_SCOPE}`;
    expect(hasScope(granted, YOUTUBE_READONLY_SCOPE)).toBe(true);
    expect(hasScope(granted, "email")).toBe(true);
  });

  it("also reads comma-separated grants", () => {
    expect(hasScope("streaming,user-read-email", "streaming")).toBe(true);
  });

  it("matches whole scopes only", () => {
    expect(
      hasScope("https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/youtube"),
    ).toBe(false);
    expect(hasScope("user-read-email", "user-read")).toBe(false);
  });

  it("is false when nothing was granted", () => {
    expect(hasScope(null, "streaming")).toBe(false);
    expect(hasScope(undefined, "streaming")).toBe(false);
    expect(hasScope("", "streaming")).toBe(false);
  });
});
