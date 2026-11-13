import { withBase } from "~/lib/base-path";

/**
 * The URL Auth.js should see for an auth request: AUTH_URL's origin plus the request's full path,
 * base path included. Auth.js derives OAuth redirect URIs from it.
 *
 * The origin comes from AUTH_URL whole, port included. Inside the container the request URL has
 * the server's own port, 3000, and swapping in only AUTH_URL's host keeps that port, which turned
 * https://sleeep.dev into https://sleeep.dev:3000 in production.
 */
export function publicAuthUrl(requestUrl: string, authUrl: string | undefined): URL {
  const { origin, pathname, search } = new URL(requestUrl);
  return new URL(`${withBase(pathname)}${search}`, authUrl ? new URL(authUrl).origin : origin);
}
