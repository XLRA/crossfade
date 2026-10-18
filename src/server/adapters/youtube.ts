import "server-only";

import { env } from "~/env";
import { type TrackData } from "~/lib/types";
import { cached, normalizeQuery } from "~/server/cache";
import { canSpendYouTube, markQuotaExhausted, spendQuota } from "~/server/quota";
import { AdapterError, type LibraryPlaylist, type PlatformAdapter } from "./types";
import { decodeEntities, parseIsoDuration, splitVideoTitle, youtubeThumbnail } from "./youtube-text";

const API = "https://www.googleapis.com/youtube/v3";
const MUSIC_CATEGORY = "10";
const MAX_IMPORT_ITEMS = 500;

type Thumbnails = Partial<Record<"default" | "medium" | "high" | "standard" | "maxres", { url: string }>>;

type Video = {
  id: string;
  snippet?: {
    title: string;
    channelTitle: string;
    liveBroadcastContent?: "none" | "live" | "upcoming";
  };
  contentDetails?: { duration?: string; contentRating?: { ytRating?: string } };
  status?: { embeddable?: boolean; privacyStatus?: string };
};

type Page<T> = { items?: T[]; nextPageToken?: string; pageInfo?: { totalResults?: number } };

type ErrorBody = { error?: { message?: string; errors?: { reason?: string }[] } };

async function request<T>(
  path: string,
  params: Record<string, string>,
  { cost, accessToken }: { cost: number; accessToken?: string },
): Promise<T> {
  if (!accessToken && !env.YOUTUBE_API_KEY) {
    throw new AdapterError("YOUTUBE", "not_configured", "YOUTUBE_API_KEY is not set");
  }
  if (!(await canSpendYouTube(cost))) {
    throw new AdapterError("YOUTUBE", "quota", "Daily YouTube quota is used up");
  }

  const url = new URL(`${API}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  if (!accessToken) url.searchParams.set("key", env.YOUTUBE_API_KEY!);

  const res = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  // Google bills the call whether or not it succeeds.
  await spendQuota("youtube", cost);

  if (res.ok) return (await res.json()) as T;

  const body = (await res.json().catch(() => ({}))) as ErrorBody;
  const reason = body.error?.errors?.[0]?.reason;
  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
    await markQuotaExhausted("youtube");
    throw new AdapterError("YOUTUBE", "quota", "YouTube quota exceeded");
  }
  if (res.status === 401 || reason === "insufficientPermissions" || reason === "forbidden") {
    throw new AdapterError("YOUTUBE", "unauthorized", body.error?.message ?? "Not authorized");
  }
  if (res.status === 404) throw new AdapterError("YOUTUBE", "not_found", "Not found");
  if (res.status === 429 || reason === "rateLimitExceeded") {
    throw new AdapterError("YOUTUBE", "rate_limited", "Rate limited");
  }
  throw new AdapterError("YOUTUBE", "upstream", body.error?.message ?? `HTTP ${res.status}`);
}

export function videoToTrack(video: Video): TrackData | null {
  const snippet = video.snippet;
  if (!snippet) return null; // private or deleted
  if (snippet.liveBroadcastContent === "live" || snippet.liveBroadcastContent === "upcoming") return null;
  if (video.status?.embeddable === false) return null; // can't be played outside youtube.com
  const { title, artist } = splitVideoTitle(snippet.title, snippet.channelTitle);
  return {
    source: "YOUTUBE",
    sourceId: video.id,
    title,
    artist,
    album: null,
    albumId: null,
    artworkUrl: youtubeThumbnail(video.id),
    durationMs: parseIsoDuration(video.contentDetails?.duration),
    explicit: video.contentDetails?.contentRating?.ytRating === "ytAgeRestricted",
    isrc: null,
  };
}

function inOrder(ids: string[], tracks: TrackData[]): TrackData[] {
  const byId = new Map(tracks.map((t) => [t.sourceId, t]));
  return ids.map((id) => byId.get(id)).filter((t): t is TrackData => Boolean(t));
}

async function lookup(ids: string[], accessToken?: string): Promise<TrackData[]> {
  const unique = [...new Set(ids)];
  const out: TrackData[] = [];
  // videos.list takes up to 50 ids per call for 1 unit, which is what makes imports cheap.
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const page = await request<Page<Video>>(
      "/videos",
      { part: "snippet,contentDetails,status", id: batch.join(","), maxResults: "50" },
      { cost: 1, accessToken },
    );
    for (const video of page.items ?? []) {
      const track = videoToTrack(video);
      if (track) out.push(track);
    }
  }
  return inOrder(unique, out);
}

export const youtube = {
  source: "YOUTUBE",
  get configured() {
    return Boolean(env.YOUTUBE_API_KEY);
  },

  async search(query: string, limit = 12): Promise<TrackData[]> {
    const q = normalizeQuery(query);
    // Identical searches are served from cache for a day: one fresh search costs 1% of the
    // daily budget.
    return cached(`yt:search:v2:${limit}:${q}`, 60 * 60 * 24, async () => {
      const result = await request<Page<{ id?: { videoId?: string } }>>(
        "/search",
        {
          part: "snippet",
          fields: "items(id/videoId)",
          type: "video",
          q,
          maxResults: String(limit),
          videoCategoryId: MUSIC_CATEGORY,
          videoEmbeddable: "true",
          videoSyndicated: "true",
        },
        { cost: 100 },
      );
      const ids = (result.items ?? []).map((item) => item.id?.videoId).filter((id): id is string => !!id);
      return ids.length ? lookup(ids) : [];
    });
  },

  async getTracks(ids: string[]): Promise<TrackData[]> {
    if (ids.length === 0) return [];
    const key = `yt:videos:v2:${[...ids].sort().join(",")}`;
    return cached(key, 60 * 60 * 24 * 7, () => lookup(ids));
  },

  /** Most popular music videos for a region. 1 unit, refreshed every few hours. */
  async trending(regionCode = "US", limit = 24): Promise<TrackData[]> {
    return cached(`yt:trending:v2:${regionCode}:${limit}`, 60 * 60 * 4, async () => {
      const page = await request<Page<Video>>(
        "/videos",
        {
          part: "snippet,contentDetails,status",
          chart: "mostPopular",
          videoCategoryId: MUSIC_CATEGORY,
          regionCode,
          maxResults: String(limit),
        },
        { cost: 1 },
      );
      return (page.items ?? []).map(videoToTrack).filter((t): t is TrackData => Boolean(t));
    });
  },

  /**
   * Keyless fallback for a pasted link: YouTube's oEmbed endpoint gives title, channel and
   * thumbnail without touching the API quota. It doesn't know the duration; the player fills
   * that in once the video loads.
   */
  async oembed(videoId: string): Promise<TrackData | null> {
    return cached(`yt:oembed:v1:${videoId}`, 60 * 60 * 24 * 7, async () => {
      const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6_000), cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as { title?: string; author_name?: string };
      if (!data.title) return null;
      const { title, artist } = splitVideoTitle(data.title, data.author_name ?? "YouTube");
      return {
        source: "YOUTUBE",
        sourceId: videoId,
        title,
        artist,
        album: null,
        albumId: null,
        artworkUrl: youtubeThumbnail(videoId),
        durationMs: 0,
        explicit: false,
        isrc: null,
      } satisfies TrackData;
    });
  },

  // --- A user's own library (OAuth, youtube.readonly) -------------------------------------------

  async listPlaylists(accessToken: string): Promise<LibraryPlaylist[]> {
    const out: LibraryPlaylist[] = [];

    const channels = await request<Page<{ contentDetails?: { relatedPlaylists?: { likes?: string } } }>>(
      "/channels",
      { part: "contentDetails", mine: "true" },
      { cost: 1, accessToken },
    );
    const likesId = channels.items?.[0]?.contentDetails?.relatedPlaylists?.likes;
    if (likesId) {
      const likes = await request<Page<unknown>>(
        "/playlistItems",
        { part: "id", playlistId: likesId, maxResults: "1" },
        { cost: 1, accessToken },
      ).catch(() => null);
      out.push({
        id: likesId,
        name: "Liked videos",
        description: "Videos you liked on YouTube",
        imageUrl: null,
        trackCount: likes?.pageInfo?.totalResults ?? 0,
        owner: null,
      });
    }

    let pageToken: string | undefined;
    do {
      const page = await request<
        Page<{
          id: string;
          snippet?: { title: string; description?: string; channelTitle?: string; thumbnails?: Thumbnails };
          contentDetails?: { itemCount?: number };
        }>
      >(
        "/playlists",
        { part: "snippet,contentDetails", mine: "true", maxResults: "50", ...(pageToken ? { pageToken } : {}) },
        { cost: 1, accessToken },
      );
      for (const item of page.items ?? []) {
        const thumbs = item.snippet?.thumbnails;
        out.push({
          id: item.id,
          name: decodeEntities(item.snippet?.title ?? "Untitled playlist"),
          description: item.snippet?.description ? decodeEntities(item.snippet.description) : null,
          imageUrl: thumbs?.medium?.url ?? thumbs?.high?.url ?? thumbs?.default?.url ?? null,
          trackCount: item.contentDetails?.itemCount ?? 0,
          owner: item.snippet?.channelTitle ?? null,
        });
      }
      pageToken = page.nextPageToken;
    } while (pageToken && out.length < 200);

    return out;
  },

  /** Every playable video in one of the user's playlists, in playlist order. */
  async playlistTracks(accessToken: string, playlistId: string): Promise<{ tracks: TrackData[]; skipped: number }> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const page = await request<Page<{ contentDetails?: { videoId?: string } }>>(
        "/playlistItems",
        {
          part: "contentDetails",
          playlistId,
          maxResults: "50",
          ...(pageToken ? { pageToken } : {}),
        },
        { cost: 1, accessToken },
      );
      for (const item of page.items ?? []) {
        if (item.contentDetails?.videoId) ids.push(item.contentDetails.videoId);
      }
      pageToken = page.nextPageToken;
    } while (pageToken && ids.length < MAX_IMPORT_ITEMS);

    const tracks = await lookup(ids.slice(0, MAX_IMPORT_ITEMS), accessToken);
    return { tracks, skipped: ids.length - tracks.length };
  },
} satisfies PlatformAdapter & Record<string, unknown>;
