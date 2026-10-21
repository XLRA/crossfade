import { type TrackData } from "~/lib/types";
import { type RouterOutputs } from "~/trpc/react";

export type SearchResult = RouterOutputs["search"]["tracks"];

/** Takes turns between platforms so neither one buries the other in the combined list. */
export function interleave(lists: TrackData[][]): TrackData[] {
  const out: TrackData[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const item = list[i];
      if (item) out.push(item);
    }
  }
  return out;
}

/**
 * Every playable track in a search response, platforms interleaved. Spotify leads for people who
 * can play its full tracks; everyone else would get 30-second previews, so YouTube leads for them.
 */
export function resultTracks(data: SearchResult | undefined, { spotifyFirst = false } = {}): TrackData[] {
  if (!data) return [];
  if (data.isLink) {
    if (data.link.kind === "track") return [data.link.track];
    if (data.link.kind === "collection") return data.link.tracks;
    return [];
  }
  const { spotify, youtube } = data;
  return interleave(spotifyFirst ? [spotify.tracks, youtube.tracks] : [youtube.tracks, spotify.tracks]);
}
