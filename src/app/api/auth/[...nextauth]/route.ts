import { Auth } from "@auth/core";
import { type NextRequest } from "next/server";

import { BASE_PATH } from "~/lib/base-path";
import { authConfig } from "~/server/auth";

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
  const url = new URL(req.url);
  if (process.env.AUTH_URL) {
    const publicUrl = new URL(process.env.AUTH_URL);
    url.protocol = publicUrl.protocol;
    url.host = publicUrl.host;
  }
  if (!url.pathname.startsWith(`${BASE_PATH}/`)) url.pathname = `${BASE_PATH}${url.pathname}`;

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers: req.headers,
    body: hasBody ? req.body : undefined,
    // Required by undici when forwarding a streamed body.
    ...(hasBody ? { duplex: "half" } : {}),
  } as RequestInit);
}

export const GET = (req: NextRequest) => Auth(publicRequest(req), authConfig);
export const POST = (req: NextRequest) => Auth(publicRequest(req), authConfig);
