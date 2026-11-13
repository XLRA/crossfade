import { describe, expect, it } from "vitest";

import { publicAuthUrl } from "./public-url";

describe("publicAuthUrl", () => {
  it("takes the whole origin from AUTH_URL, dropping the server's port", () => {
    const url = publicAuthUrl("http://0.0.0.0:3000/api/auth/signin/google", "https://sleeep.dev/crossfade/api/auth");
    expect(url.href).toBe("https://sleeep.dev/crossfade/api/auth/signin/google");
  });

  it("keeps a port that AUTH_URL names, and the query", () => {
    const url = publicAuthUrl(
      "http://localhost:3000/crossfade/api/auth/callback/spotify?code=abc&state=xyz",
      "http://127.0.0.1:3000/crossfade/api/auth",
    );
    expect(url.href).toBe("http://127.0.0.1:3000/crossfade/api/auth/callback/spotify?code=abc&state=xyz");
  });

  it("keeps the request's own origin without AUTH_URL", () => {
    const url = publicAuthUrl("http://127.0.0.1:3000/api/auth/session", undefined);
    expect(url.href).toBe("http://127.0.0.1:3000/crossfade/api/auth/session");
  });
});
