import { Auth } from "@auth/core";
import { type NextRequest } from "next/server";

import { authConfig } from "~/server/auth";
import { publicAuthUrl } from "~/server/auth/public-url";

/**
 * Hands the request to Auth.js with its public URL.
 *
 * next-auth's own handler rebuilds the request as a NextRequest, and two Next behaviors break
 * that for us: route handlers get the URL with the /crossfade base path stripped, and NextURL
 * rewrites 127.0.0.1 to localhost. Auth.js derives OAuth redirect URIs from that URL, so the token
 * exchange would use a different redirect URI than the authorization request did. A plain Request
 * built from AUTH_URL's origin plus the full path avoids both.
 */
function publicRequest(req: NextRequest): Request {
  const url = publicAuthUrl(req.url, process.env.AUTH_URL);
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers: req.headers,
    body: hasBody ? req.body : undefined,
    // Required by undici when forwarding a streamed body.
    ...(hasBody ? { duplex: "half" } : {}),
  });
}

export const GET = (req: NextRequest) => Auth(publicRequest(req), authConfig);
export const POST = (req: NextRequest) => Auth(publicRequest(req), authConfig);
