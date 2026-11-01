import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { type SourceName } from "~/lib/types";
import { AdapterError, type Collection, spotify, youtube } from "~/server/adapters";
import { type LibraryPlaylist } from "~/server/adapters/types";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { YOUTUBE_READONLY_SCOPE } from "~/server/auth/scopes";
import { ConnectionError, getAccessToken, type Provider, tryAccessToken } from "~/server/connections";
import { importedCopies, saveAsPlaylist } from "~/server/importer";
import { rateLimit } from "~/server/rate-limit";

/** Why a library can't be listed, in terms the import page can act on. */
type LibraryStatus = "ok" | "not_connected" | "needs_access" | "expired" | "unavailable";

type ImportablePlaylist = LibraryPlaylist & {
  /** False for playlists the platform won't share (Spotify: ones you only follow). */
  importable: boolean;
  /** The Crossfade copy, if it's been imported before. */
  importedAs: string | null;
};

type LibraryResult = { status: LibraryStatus; playlists: ImportablePlaylist[] };

function statusOf(error: unknown): LibraryStatus {
  if (error instanceof ConnectionError) {
    if (error.code === "not_connected") return "not_connected";
    if (error.code === "missing_scope") return "needs_access";
    if (error.code === "expired") return "expired";
    return "unavailable";
  }
  if (error instanceof AdapterError) {
    if (error.code === "unauthorized") return "expired";
    return "unavailable";
  }
  throw error;
}

async function listLibrary(
  userId: string,
  provider: Provider,
  source: SourceName,
  list: (token: string, accountId: string) => Promise<(LibraryPlaylist & { importable?: boolean })[]>,
  scope?: string,
): Promise<LibraryResult> {
  try {
    const { token, providerAccountId } = await getAccessToken(userId, provider, { scope });
    const playlists = await list(token, providerAccountId);
    const imported = await importedCopies(
      userId,
      source,
      playlists.map((p) => p.id),
    );
    return {
      status: "ok",
      playlists: playlists.map((p) => ({
        ...p,
        importable: p.importable ?? true,
        importedAs: imported.get(p.id) ?? null,
      })),
    };
  } catch (error) {
    const status = statusOf(error);
    if (status === "unavailable") console.error(`[library] ${provider}`, error);
    return { status, playlists: [] };
  }
}

export const libraryRouter = createTRPCRouter({
  /** The user's Spotify playlists (owned, collaborative and followed). */
  spotifyPlaylists: protectedProcedure.query(({ ctx }) =>
    listLibrary(ctx.session.user.id, "spotify", "SPOTIFY", (token, accountId) =>
      spotify.listPlaylists(token, accountId),
    ),
  ),

  /** The user's YouTube playlists plus "Liked videos". Needs the youtube.readonly grant. */
  youtubePlaylists: protectedProcedure.query(({ ctx }) =>
    listLibrary(
      ctx.session.user.id,
      "google",
      "YOUTUBE",
      (token) => youtube.listPlaylists(token),
      YOUTUBE_READONLY_SCOPE,
    ),
  ),

  /**
   * Copies a platform playlist or album into a new Crossfade playlist. Spotify playlists are read
   * with the user's own token; albums with the app's. YouTube playlists use the user's token when
   * they've granted it (private playlists, liked videos), the API key otherwise.
   */
  importPlaylist: protectedProcedure
    .input(
      z.object({
        source: z.enum(["SPOTIFY", "YOUTUBE"]),
        kind: z.enum(["playlist", "album"]),
        // Platform ids, plus YouTube's two-letter "LL" for liked videos.
        id: z.string().regex(/^(?:LL|[A-Za-z0-9_-]{10,64})$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      if (!rateLimit(`import:${userId}`, 6, 60_000)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "That's a lot of imports at once. Give it a minute.",
        });
      }

      let collection: Collection | null;
      try {
        if (input.source === "SPOTIFY") {
          if (input.kind === "album") {
            collection = await spotify.album(input.id);
          } else {
            const { token } = await getAccessToken(userId, "spotify");
            collection = await spotify.playlist(token, input.id);
          }
        } else {
          if (input.kind === "album") throw new TRPCError({ code: "BAD_REQUEST", message: "YouTube has no albums." });
          const token = await tryAccessToken(userId, "google", { scope: YOUTUBE_READONLY_SCOPE });
          if (!token && !youtube.configured) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "Allow access to your YouTube library in Settings to import from YouTube.",
            });
          }
          collection = await youtube.collection(input.id, token?.token);
        }
      } catch (error) {
        if (error instanceof ConnectionError) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: error.message });
        }
        if (error instanceof AdapterError) {
          const message =
            error.code === "quota" || error.code === "rate_limited"
              ? "The platform's limit is used up for now. Try again later."
              : error.code === "unauthorized"
                ? "The platform wouldn't share that playlist. Try reconnecting in Settings."
                : "The platform didn't answer. Try again in a moment.";
          throw new TRPCError({ code: "BAD_GATEWAY", message });
        }
        throw error;
      }

      if (!collection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            input.kind === "album"
              ? "Spotify couldn't find that album. It may not be available in this region."
              : input.source === "SPOTIFY"
                ? "Spotify only shares the tracks of playlists you own or collaborate on."
                : "That playlist is private or doesn't exist anymore.",
        });
      }
      if (collection.tracks.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "There's nothing in it that can play here." });
      }

      const saved = await saveAsPlaylist({
        ownerId: userId,
        title: collection.title,
        description: collection.subtitle,
        tracks: collection.tracks,
        source: input.source,
        sourceId: input.id,
      });
      return { ...saved, skipped: collection.skipped + (collection.tracks.length - saved.added) };
    }),
});
