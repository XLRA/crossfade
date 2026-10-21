import "server-only";

import { env } from "~/env";
import { type Connections } from "~/lib/types";
import { hasScope, YOUTUBE_READONLY_SCOPE } from "~/server/auth/scopes";
import { db } from "~/server/db";

/*
 * Linked Spotify and Google accounts. Auth.js stores their tokens in the Account table; this module
 * hands out a valid access token, refreshing it when it's about to expire. The tokens never go in
 * the session cookie.
 */

export type Provider = "spotify" | "google";

export type ConnectionErrorCode = "not_connected" | "missing_scope" | "expired" | "upstream";

export class ConnectionError extends Error {
  constructor(
    readonly provider: Provider,
    readonly code: ConnectionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ConnectionError";
  }
}

const NAMES: Record<Provider, string> = {
  spotify: "Spotify",
  google: "Google",
};

export type AccessToken = {
  token: string;
  expiresAt: number;
  providerAccountId: string;
};

type AccountRow = {
  id: string;
  providerAccountId: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  scope: string | null;
};

/** One refresh per account at a time; concurrent callers share it. */
const refreshing = new Map<string, Promise<AccessToken>>();

/**
 * A usable access token for the user's linked account, refreshed if it expires within a minute.
 * Throws a ConnectionError the UI can turn into "Connect" or "Reconnect".
 */
export async function getAccessToken(
  userId: string,
  provider: Provider,
  { scope }: { scope?: string } = {},
): Promise<AccessToken> {
  const account = await db.account.findFirst({
    where: { userId, provider },
    select: {
      id: true,
      providerAccountId: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
      scope: true,
    },
  });
  if (!account) {
    throw new ConnectionError(provider, "not_connected", `Connect ${NAMES[provider]} first.`);
  }
  if (scope && !hasScope(account.scope, scope)) {
    throw new ConnectionError(provider, "missing_scope", `${NAMES[provider]} hasn't granted that access yet.`);
  }

  const expiresAt = (account.expires_at ?? 0) * 1000;
  if (account.access_token && expiresAt - 60_000 > Date.now()) {
    return {
      token: account.access_token,
      expiresAt,
      providerAccountId: account.providerAccountId,
    };
  }
  if (!account.refresh_token) {
    throw new ConnectionError(
      provider,
      "expired",
      `Your ${NAMES[provider]} connection expired. Reconnect it in Settings.`,
    );
  }

  let pending = refreshing.get(account.id);
  if (!pending) {
    pending = refresh(provider, account).finally(() => refreshing.delete(account.id));
    refreshing.set(account.id, pending);
  }
  return pending;
}

async function refresh(provider: Provider, account: AccountRow): Promise<AccessToken> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: account.refresh_token!,
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  let url: string;
  if (provider === "spotify") {
    url = "https://accounts.spotify.com/api/token";
    headers.Authorization = `Basic ${Buffer.from(`${env.AUTH_SPOTIFY_ID}:${env.AUTH_SPOTIFY_SECRET}`).toString("base64")}`;
  } else {
    url = "https://oauth2.googleapis.com/token";
    body.set("client_id", env.AUTH_GOOGLE_ID ?? "");
    body.set("client_secret", env.AUTH_GOOGLE_SECRET ?? "");
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new ConnectionError(provider, "upstream", `Couldn't reach ${NAMES[provider]}. Try again in a moment.`);
  }
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    error?: string;
  };

  if (!res.ok || !data.access_token) {
    if (data.error === "invalid_grant") {
      // Revoked from the provider's side, or the refresh token aged out. Forget the dead tokens so
      // the UI offers to reconnect instead of failing on every call.
      await db.account.update({
        where: { id: account.id },
        data: { access_token: null, refresh_token: null, expires_at: null },
      });
      throw new ConnectionError(
        provider,
        "expired",
        `Your ${NAMES[provider]} connection expired. Reconnect it in Settings.`,
      );
    }
    throw new ConnectionError(
      provider,
      "upstream",
      `${NAMES[provider]} didn't refresh the connection. Try again in a moment.`,
    );
  }

  const expiresAt = Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600);
  await db.account.update({
    where: { id: account.id },
    data: {
      access_token: data.access_token,
      expires_at: expiresAt,
      // Spotify sometimes rotates the refresh token; Google never sends a new one.
      ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
      ...(data.scope ? { scope: data.scope } : {}),
    },
  });
  return {
    token: data.access_token,
    expiresAt: expiresAt * 1000,
    providerAccountId: account.providerAccountId,
  };
}

/** The same token, or null when the user hasn't connected (or granted) it. Other failures still throw. */
export async function tryAccessToken(
  userId: string | null | undefined,
  provider: Provider,
  options?: { scope?: string },
): Promise<AccessToken | null> {
  if (!userId) return null;
  try {
    return await getAccessToken(userId, provider, options);
  } catch (error) {
    if (error instanceof ConnectionError && error.code !== "upstream") return null;
    throw error;
  }
}

/** What the user has linked, for the UI. */
export async function connectionsFor(userId: string): Promise<Connections> {
  const accounts = await db.account.findMany({
    where: { userId },
    select: {
      provider: true,
      scope: true,
      access_token: true,
      refresh_token: true,
    },
  });
  const spotify = accounts.find((a) => a.provider === "spotify");
  const google = accounts.find((a) => a.provider === "google");
  return {
    spotify: Boolean(spotify),
    spotifyExpired: Boolean(spotify && !spotify.access_token && !spotify.refresh_token),
    spotifyPlayback: Boolean(spotify && hasScope(spotify.scope, "streaming")),
    google: Boolean(google),
    youtube: Boolean(google && hasScope(google.scope, YOUTUBE_READONLY_SCOPE)),
    loginMethods: accounts.length,
  };
}
