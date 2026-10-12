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

/** Every playable track in a search response, platforms interleaved. */
export function resultTracks(data: SearchResult | undefined): TrackData[] {
  if (!data) return [];
  if (data.isLink) return data.link ? [data.link] : [];
  return interleave([data.youtube.tracks]);
}
