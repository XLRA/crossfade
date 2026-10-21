import "server-only";

import { type ProviderStatus, type SourceName, type TrackData } from "~/lib/types";
import { spotify } from "./spotify";
import { AdapterError } from "./types";
import { youtube } from "./youtube";

export { AdapterError, type Collection } from "./types";
export { spotify, youtube };

export type ProviderResult = { status: ProviderStatus; tracks: TrackData[] };

/** Runs one platform call and turns its failure modes into a status the UI can explain. */
export async function settle(source: SourceName, run: () => Promise<TrackData[]>): Promise<ProviderResult> {
  try {
    return { status: "ok", tracks: await run() };
  } catch (error) {
    if (error instanceof AdapterError) {
      if (error.code === "not_configured") return { status: "disabled", tracks: [] };
      if (error.code === "quota" || error.code === "rate_limited") return { status: "quota", tracks: [] };
    }
    console.error(`[${source.toLowerCase()}]`, error);
    return { status: "unavailable", tracks: [] };
  }
}
