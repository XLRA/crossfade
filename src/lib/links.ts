import { type SourceName, type TrackRef } from "~/lib/types";

export type ParsedLink = { source: SourceName; kind: "track" | "playlist" | "album"; id: string };

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

/**
 * Recognizes the YouTube and Spotify links people actually paste: youtu.be short links, watch
 * URLs (including music.youtube.com and mobile), shorts/embed/live paths, open.spotify.com URLs
 * with or without an intl-xx prefix, and spotify: URIs.
 */
export function parseMusicLink(input: string): ParsedLink | null {
  const text = input.trim();

  const uri = /^spotify:(track|album|playlist):([A-Za-z0-9]{22})$/.exec(text);
  if (uri) return { source: "SPOTIFY", kind: uri[1] as ParsedLink["kind"], id: uri[2]! };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0] ?? "";
    return YT_ID.test(id) ? { source: "YOUTUBE", kind: "track", id } : null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v");
    if (v && YT_ID.test(v)) return { source: "YOUTUBE", kind: "track", id: v };
    const list = url.searchParams.get("list");
    if (url.pathname === "/playlist" && list) return { source: "YOUTUBE", kind: "playlist", id: list };
    const path = /^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/.exec(url.pathname);
    if (path) return { source: "YOUTUBE", kind: "track", id: path[1]! };
    return null;
  }

  if (host === "open.spotify.com" || host === "play.spotify.com") {
    const match = /^\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(track|album|playlist)\/([A-Za-z0-9]+)/i.exec(
      url.pathname,
    );
    if (match && SPOTIFY_ID.test(match[2]!)) {
      return { source: "SPOTIFY", kind: match[1]!.toLowerCase() as ParsedLink["kind"], id: match[2]! };
    }
  }

  return null;
}

export function looksLikeLink(input: string): boolean {
  return /^(https?:\/\/|spotify:|(www\.|m\.|music\.)?(youtube\.com|youtu\.be|open\.spotify\.com))/i.test(
    input.trim(),
  );
}

/** The track's own page on its platform. */
export function sourceUrl(track: TrackRef): string {
  return track.source === "YOUTUBE"
    ? `https://www.youtube.com/watch?v=${track.sourceId}`
    : `https://open.spotify.com/track/${track.sourceId}`;
}
