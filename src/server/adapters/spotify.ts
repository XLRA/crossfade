import "server-only";

import { env } from "~/env";
import { type TrackData } from "~/lib/types";
import { cached, normalizeQuery, prime } from "~/server/cache";
import { AdapterError, type Collection, type LibraryPlaylist, type PlatformAdapter } from "./types";

/*
 * Spotify Web API. Search and lookups use the app's own token (client credentials), so guests get
 * Spotify results too; anything in someone's library uses their token.
 *
 * Written against the February 2026 development-mode rules: search returns at most 10 items per
 * type, the batch lookups (GET /tracks?ids=) are gone, and playlist contents moved from /tracks
 * to /items, readable only for playlists the user owns or collaborates on.
 * https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
 */

const API = "https://api.spotify.com/v1";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

export const SPOTIFY_SEARCH_LIMIT = 10;
const MAX_COLLECTION_ITEMS = 500;
/** Parallel single-track lookups. Spotify rate limits per app over a rolling 30 seconds. */
const LOOKUP_CONCURRENCY = 4;

type Image = { url: string; width?: number | null; height?: number | null };

export type SpotifyTrackObject = {
  id: string | null;
  type?: string;
  uri?: string;
  name: string;
  duration_ms: number;
  explicit: boolean;
  is_local?: boolean;
  is_playable?: boolean;
  external_ids?: { isrc?: string };
  artists?: { id: string | null; name: string }[];
  album?: { id: string | null; name: string; images?: Image[] };
};

type Paging<T> = { items: T[]; next: string | null; total: number };

/** A playlist row. `items` replaced `tracks` in 2026; both are read so either shape works. */
type PlaylistEntry = {
  is_local?: boolean;
  item?: SpotifyTrackObject | null;
  track?: SpotifyTrackObject | null;
};

type SimplePlaylist = {
  id: string;
  name: string;
  description?: string | null;
  collaborative?: boolean;
  public?: boolean | null;
  images?: Image[] | null;
  owner?: { id: string; display_name?: string | null };
  items?: { total?: number } | null;
  tracks?: { total?: number } | null;
};

/** GET /playlists/{id}. The contents are under `items` (or `tracks` before 2026), when shared at all. */
type FullPlaylist = Omit<SimplePlaylist, "items" | "tracks"> & {
  items?: Paging<PlaylistEntry> | null;
  tracks?: Paging<PlaylistEntry> | null;
};

type Album = {
  id: string;
  name: string;
  album_type?: string;
  release_date?: string;
  images?: Image[];
  artists?: { name: string }[];
  tracks?: Paging<SpotifyTrackObject>;
  total_tracks?: number;
};

/** A user playlist with whether its tracks can be read with that user's token. */
export type SpotifyLibraryPlaylist = LibraryPlaylist & { importable: boolean };

// --- App token (client credentials) ------------------------------------------------------------

let appToken: { value: string; expiresAt: number } | null = null;
let appTokenRequest: Promise<string> | null = null;

function basicAuth(): string {
  return `Basic ${Buffer.from(`${env.AUTH_SPOTIFY_ID}:${env.AUTH_SPOTIFY_SECRET}`).toString("base64")}`;
}

async function getAppToken(): Promise<string> {
  if (!env.AUTH_SPOTIFY_ID || !env.AUTH_SPOTIFY_SECRET) {
    throw new AdapterError("SPOTIFY", "not_configured", "Spotify client credentials are not set");
  }
  if (appToken && appToken.expiresAt - 60_000 > Date.now()) return appToken.value;

  appTokenRequest ??= (async () => {
    try {
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: basicAuth(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }),
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) {
        throw new AdapterError(
          "SPOTIFY",
          res.status === 400 || res.status === 401 ? "unauthorized" : "upstream",
          `Spotify token request failed (HTTP ${res.status})`,
        );
      }
      const body = (await res.json()) as {
        access_token: string;
        expires_in: number;
      };
      appToken = {
        value: body.access_token,
        expiresAt: Date.now() + body.expires_in * 1000,
      };
      return appToken.value;
    } finally {
      appTokenRequest = null;
    }
  })();
  return appTokenRequest;
}

// --- Requests ----------------------------------------------------------------------------------

/** After a 429, every call fails fast until Spotify's Retry-After has passed. */
let backoffUntil = 0;

async function request<T>(
  path: string,
  { params, accessToken }: { params?: Record<string, string>; accessToken?: string } = {},
): Promise<T> {
  if (Date.now() < backoffUntil) {
    throw new AdapterError("SPOTIFY", "rate_limited", "Spotify asked us to slow down");
  }
  const token = accessToken ?? (await getAppToken());
  const url = path.startsWith("https://") ? new URL(path) : new URL(`${API}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (res.ok) return (await res.json()) as T;

  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string } | string;
  };
  const message = typeof body.error === "string" ? body.error : (body.error?.message ?? `HTTP ${res.status}`);

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "5");
    backoffUntil = Date.now() + Math.min(Number.isFinite(retryAfter) ? retryAfter : 5, 300) * 1000;
    throw new AdapterError("SPOTIFY", "rate_limited", "Spotify rate limit");
  }
  if (res.status === 401) {
    if (!accessToken) appToken = null;
    throw new AdapterError("SPOTIFY", "unauthorized", message);
  }
  // Development-mode apps answer 403 for accounts that aren't on the app's user list.
  if (res.status === 403) throw new AdapterError("SPOTIFY", "unauthorized", message);
  if (res.status === 404 || res.status === 400) throw new AdapterError("SPOTIFY", "not_found", message);
  throw new AdapterError("SPOTIFY", "upstream", message);
}

/** Every page of a paging object, up to `max` items. */
async function collect<T>(first: Paging<T>, accessToken: string | undefined, max: number): Promise<T[]> {
  const items = [...first.items];
  let next = first.next;
  while (next && items.length < max) {
    const page = await request<Paging<T>>(next, { accessToken });
    items.push(...page.items);
    next = page.next;
  }
  return items.slice(0, max);
}

async function mapLimit<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await run(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// --- Mapping -----------------------------------------------------------------------------------

/** The ~300px rendition: sharp in rows and cards without pulling the 640px original everywhere. */
export function pickImage(images: Image[] | null | undefined): string | null {
  if (!images?.length) return null;
  const sized = images.filter((i) => i.width);
  const medium = sized.find((i) => i.width! >= 200 && i.width! <= 400);
  return (medium ?? images[0]!).url;
}

export function toTrack(track: SpotifyTrackObject | null | undefined, album?: Album): TrackData | null {
  if (!track?.id || track.is_local) return null;
  if (track.type && track.type !== "track") return null; // podcast episodes in playlists
  if (track.is_playable === false) return null;
  const artists = (track.artists ?? []).map((a) => a.name).filter(Boolean);
  return {
    source: "SPOTIFY",
    sourceId: track.id,
    title: track.name,
    artist: artists.join(", ") || "Unknown artist",
    album: track.album?.name ?? album?.name ?? null,
    albumId: track.album?.id ?? album?.id ?? null,
    artworkUrl: pickImage(track.album?.images ?? album?.images),
    durationMs: track.duration_ms,
    explicit: track.explicit,
    isrc: track.external_ids?.isrc ?? null,
  };
}

function compact(tracks: (TrackData | null)[]): TrackData[] {
  return tracks.filter((t): t is TrackData => Boolean(t));
}

const market = () => env.SPOTIFY_MARKET;
const TRACK_TTL = 60 * 60 * 24 * 7;
const trackCacheKey = (id: string) => `sp:track:v1:${market()}:${id}`;

// --- Adapter -----------------------------------------------------------------------------------

export const spotify = {
  source: "SPOTIFY",
  get configured() {
    return Boolean(env.AUTH_SPOTIFY_ID && env.AUTH_SPOTIFY_SECRET);
  },

  async search(query: string, limit = SPOTIFY_SEARCH_LIMIT): Promise<TrackData[]> {
    const q = normalizeQuery(query);
    const size = Math.min(limit, SPOTIFY_SEARCH_LIMIT);
    return cached(`sp:search:v1:${market()}:${size}:${q}`, 60 * 60 * 6, async () => {
      const data = await request<{ tracks?: Paging<SpotifyTrackObject> }>("/search", {
        params: { q, type: "track", limit: String(size), market: market() },
      });
      const tracks = compact((data.tracks?.items ?? []).map((t) => toTrack(t)));
      // Adding a result to a playlist looks the track up by id; this saves that request.
      await prime(
        tracks.map((track) => ({
          key: trackCacheKey(track.sourceId),
          value: track,
        })),
        TRACK_TTL,
      );
      return tracks;
    });
  },

  /**
   * Metadata for track ids, one request each (the batch endpoint is gone for development-mode
   * apps). Each track is cached for a week, and the catalog only asks for ids it hasn't stored.
   */
  async getTracks(ids: string[]): Promise<TrackData[]> {
    const unique = [...new Set(ids)];
    const found = await mapLimit(unique, LOOKUP_CONCURRENCY, (id) =>
      cached(trackCacheKey(id), TRACK_TTL, async () => {
        try {
          return toTrack(
            await request<SpotifyTrackObject>(`/tracks/${id}`, {
              params: { market: market() },
            }),
          );
        } catch (error) {
          if (error instanceof AdapterError && error.code === "not_found") return null;
          throw error;
        }
      }),
    );
    return compact(found);
  },

  async album(id: string): Promise<Collection | null> {
    return cached(`sp:album:v1:${market()}:${id}`, 60 * 60 * 24, async () => {
      let album: Album;
      try {
        album = await request<Album>(`/albums/${id}`, {
          params: { market: market() },
        });
      } catch (error) {
        if (error instanceof AdapterError && error.code === "not_found") return null;
        throw error;
      }
      const entries = album.tracks ? await collect(album.tracks, undefined, MAX_COLLECTION_ITEMS) : [];
      const tracks = compact(entries.map((t) => toTrack(t, album)));
      const year = album.release_date?.slice(0, 4);
      const artists = (album.artists ?? []).map((a) => a.name).join(", ");
      return {
        title: album.name,
        subtitle: [artists, year].filter(Boolean).join(" · ") || null,
        artworkUrl: pickImage(album.images),
        tracks,
        skipped: entries.length - tracks.length,
      };
    });
  },

  // --- A user's library (their token) ---------------------------------------------------------

  async listPlaylists(accessToken: string, spotifyUserId: string): Promise<SpotifyLibraryPlaylist[]> {
    const first = await request<Paging<SimplePlaylist>>("/me/playlists", {
      params: { limit: "50" },
      accessToken,
    });
    const playlists = await collect(first, accessToken, 300);
    return playlists
      .filter((p): p is SimplePlaylist => Boolean(p?.id))
      .map((p) => ({
        id: p.id,
        name: p.name || "Untitled playlist",
        description: p.description ? decodeHtml(p.description) : null,
        imageUrl: pickImage(p.images),
        trackCount: p.items?.total ?? p.tracks?.total ?? 0,
        owner: p.owner?.display_name ?? null,
        // Since 2026, Spotify only returns the contents of playlists you own or collaborate on.
        importable: p.owner?.id === spotifyUserId || Boolean(p.collaborative),
      }));
  },

  /** A playlist's tracks, read with the user's token. Null when Spotify won't share them. */
  async playlist(accessToken: string, id: string): Promise<Collection | null> {
    let playlist: FullPlaylist;
    try {
      playlist = await request<FullPlaylist>(`/playlists/${id}`, {
        params: { market: market() },
        accessToken,
      });
    } catch (error) {
      if (error instanceof AdapterError && error.code === "not_found") return null;
      throw error;
    }
    const embedded = playlist.items?.items ? playlist.items : playlist.tracks?.items ? playlist.tracks : null;
    const firstPage =
      embedded ??
      (await request<Paging<PlaylistEntry>>(`/playlists/${id}/items`, {
        params: { limit: "50", market: market() },
        accessToken,
      }).catch((error: unknown) => {
        if (error instanceof AdapterError && (error.code === "not_found" || error.code === "unauthorized")) {
          return null;
        }
        throw error;
      }));
    if (!firstPage) return null;

    const entries = await collect(firstPage, accessToken, MAX_COLLECTION_ITEMS);
    const tracks = compact(entries.map((entry) => (entry.is_local ? null : toTrack(entry.item ?? entry.track))));
    return {
      title: playlist.name || "Untitled playlist",
      subtitle: playlist.owner?.display_name ? `Playlist by ${playlist.owner.display_name}` : null,
      artworkUrl: pickImage(playlist.images),
      tracks,
      skipped: entries.length - tracks.length,
    };
  },
} satisfies PlatformAdapter & Record<string, unknown>;

/** Playlist descriptions come back HTML-escaped, with the odd link in them. */
function decodeHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
