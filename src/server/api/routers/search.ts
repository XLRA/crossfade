import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { parseMusicLink, type ParsedLink } from "~/lib/links";
import { type SourceName, type TrackData } from "~/lib/types";
import { AdapterError, type Collection, settle, spotify, youtube } from "~/server/adapters";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { YOUTUBE_READONLY_SCOPE } from "~/server/auth/scopes";
import { tryAccessToken } from "~/server/connections";
import { clientIp, rateLimit } from "~/server/rate-limit";

/** What a pasted link turned out to be. */
export type LinkResult =
  | { kind: "track"; track: TrackData }
  | ({
      kind: "collection";
      source: SourceName;
      type: "album" | "playlist";
      id: string;
    } & Collection)
  | { kind: "unavailable"; source: SourceName; message: string };

const unavailable = (source: SourceName, message: string): LinkResult => ({
  kind: "unavailable",
  source,
  message,
});

async function resolveTrack(link: ParsedLink): Promise<LinkResult> {
  if (link.source === "YOUTUBE") {
    let track: TrackData | null | undefined;
    if (youtube.configured) [track] = await youtube.getTracks([link.id]).catch(() => []);
    track ??= await youtube.oembed(link.id).catch(() => null);
    return track
      ? { kind: "track", track }
      : unavailable("YOUTUBE", "That video is private, removed, or can't be played outside YouTube.");
  }
  if (!spotify.configured) return unavailable("SPOTIFY", "Spotify isn't set up on this server.");
  const [track] = await spotify.getTracks([link.id]);
  return track
    ? { kind: "track", track }
    : unavailable("SPOTIFY", "Spotify doesn't have that track, or it isn't available in this region.");
}

async function resolveCollection(link: ParsedLink, userId: string | undefined): Promise<LinkResult> {
  const type = link.kind === "album" ? "album" : "playlist";
  const wrap = (collection: Collection | null, missing: string): LinkResult =>
    collection
      ? {
          kind: "collection",
          source: link.source,
          type,
          id: link.id,
          ...collection,
        }
      : unavailable(link.source, missing);

  if (link.source === "YOUTUBE") {
    if (!youtube.configured) {
      return unavailable("YOUTUBE", "Opening YouTube playlists needs the YouTube Data API, which isn't set up here.");
    }
    // The owner's token also opens their private playlists.
    const token = await tryAccessToken(userId, "google", {
      scope: YOUTUBE_READONLY_SCOPE,
    });
    return wrap(
      await youtube.collection(link.id, token?.token),
      "That playlist is private or doesn't exist. If it's yours, import it from the Import page.",
    );
  }

  if (!spotify.configured) return unavailable("SPOTIFY", "Spotify isn't set up on this server.");
  if (type === "album") return wrap(await spotify.album(link.id), "Spotify doesn't have that album.");

  // Spotify only shares a playlist's tracks with its owner and collaborators (since 2026).
  const token = await tryAccessToken(userId, "spotify");
  if (!token) {
    return unavailable(
      "SPOTIFY",
      "Spotify only shares playlists with apps for their owners. Connect Spotify in Settings to open your own playlists.",
    );
  }
  return wrap(
    await spotify.playlist(token.token, link.id),
    "Spotify only shares a playlist's tracks with its owner and collaborators, and this one isn't yours.",
  );
}

async function resolveLink(link: ParsedLink, userId: string | undefined): Promise<LinkResult> {
  try {
    return link.kind === "track" ? await resolveTrack(link) : await resolveCollection(link, userId);
  } catch (error) {
    if (error instanceof AdapterError) {
      if (error.code === "quota" || error.code === "rate_limited") {
        return unavailable(link.source, "We've hit the platform's limit for now. Try the link again a bit later.");
      }
      if (error.code === "not_found")
        return unavailable(link.source, "That link doesn't point to anything we can open.");
    }
    console.error("[search] link", error);
    return unavailable(link.source, "The platform didn't answer. Try again in a moment.");
  }
}

export const searchRouter = createTRPCRouter({
  tracks: publicProcedure.input(z.object({ q: z.string().trim().min(1).max(200) })).query(async ({ ctx, input }) => {
    const userId = ctx.session?.user.id;
    const who = userId ?? clientIp(ctx.headers);
    if (!rateLimit(`search:${who}`, 40, 60_000)) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Slow down a little and try again.",
      });
    }

    const link = parseMusicLink(input.q);
    if (link) {
      return {
        query: input.q,
        isLink: true as const,
        link: await resolveLink(link, userId),
        youtube: null,
        spotify: null,
      };
    }

    const [spotifyResults, youtubeResults] = await Promise.all([
      settle("SPOTIFY", () => spotify.search(input.q)),
      settle("YOUTUBE", () => youtube.search(input.q, 12)),
    ]);
    return {
      query: input.q,
      isLink: false as const,
      link: null,
      spotify: spotifyResults,
      youtube: youtubeResults,
    };
  }),
});
