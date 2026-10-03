import { type SourceName, type TrackData } from "~/lib/types";

export type AdapterErrorCode =
  | "not_configured"
  | "quota"
  | "rate_limited"
  | "unauthorized"
  | "not_found"
  | "upstream";

export class AdapterError extends Error {
  constructor(
    readonly source: SourceName,
    readonly code: AdapterErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AdapterError";
  }
}

/**
 * One module per platform turns that platform's API into TrackData. Search and lookups use app
 * credentials (no user needed); anything in a user's library takes their access token.
 */
export interface PlatformAdapter {
  readonly source: SourceName;
  readonly configured: boolean;
  search(query: string, limit: number): Promise<TrackData[]>;
  /** Batch lookup by platform id. Missing or unavailable ids are left out. */
  getTracks(ids: string[]): Promise<TrackData[]>;
}

export type LibraryPlaylist = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  trackCount: number;
  owner: string | null;
};
