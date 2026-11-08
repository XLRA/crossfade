import { env } from "~/env";
import { type TrackData } from "~/lib/types";
import { youtube } from "~/server/adapters";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { fromRow } from "~/server/catalog";
import { playlistCovers } from "~/server/covers";
import { type db as database } from "~/server/db";

type Db = typeof database;

export type HomePlaylist = {
  id: string;
  title: string;
  covers: string[];
  ownerName: string;
  trackCount: number;
};

const playlistCard = {
  id: true,
  title: true,
  coverUpdatedAt: true,
  owner: { select: { name: true, username: true } },
  _count: { select: { tracks: true } },
  tracks: { orderBy: { position: "asc" }, take: 12, select: { track: { select: { artworkUrl: true } } } },
} as const;

function toCard(p: {
  id: string;
  title: string;
  coverUpdatedAt: Date | null;
  owner: { name: string | null; username: string | null };
  _count: { tracks: number };
  tracks: { track: { artworkUrl: string | null } }[];
}): HomePlaylist {
  return {
    id: p.id,
    title: p.title,
    covers: playlistCovers(
      p,
      p.tracks.map((t) => t.track.artworkUrl),
    ),
    ownerName: p.owner.name ?? p.owner.username ?? "Unknown",
    trackCount: p._count.tracks,
  };
}

/** Public playlists other listeners have been working on lately. */
async function community(db: Db, userId: string | undefined): Promise<HomePlaylist[]> {
  const rows = await db.playlist.findMany({
    where: {
      visibility: "PUBLIC",
      tracks: { some: {} },
      ...(userId && { ownerId: { not: userId }, NOT: { collaborators: { some: { userId } } } }),
    },
    orderBy: { updatedAt: "desc" },
    take: 16,
    select: playlistCard,
  });
  return rows.map(toCard);
}

async function trending(): Promise<TrackData[]> {
  if (!youtube.configured) return [];
  // The same two-letter code Spotify uses for its market works as a YouTube region.
  return youtube.trending(env.SPOTIFY_MARKET, 24).catch((error: unknown) => {
    console.error("[home] trending", error);
    return [];
  });
}

export const homeRouter = createTRPCRouter({
  /**
   * Everything the home page shows, in one round trip. Guests get public playlists and the
   * trending shelf; signed-in listeners also get what they played recently and their own playlists.
   */
  feed: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user.id;
    if (!userId) {
      const [shared, trend] = await Promise.all([community(ctx.db, undefined), trending()]);
      return { recent: [], jumpBackIn: [], playlists: [], likedCount: 0, community: shared, trending: trend };
    }

    const [plays, library, likedCount, shared, trend] = await Promise.all([
      ctx.db.play.findMany({
        where: { userId },
        orderBy: { playedAt: "desc" },
        take: 200,
        select: { contextType: true, contextId: true, track: true },
      }),
      ctx.db.playlist.findMany({
        where: { OR: [{ ownerId: userId }, { collaborators: { some: { userId } } }] },
        orderBy: { updatedAt: "desc" },
        take: 16,
        select: playlistCard,
      }),
      ctx.db.trackLike.count({ where: { userId } }),
      community(ctx.db, userId),
      trending(),
    ]);

    // Distinct tracks and playlists, most recent first.
    const seenTracks = new Set<string>();
    const recent: ReturnType<typeof fromRow>[] = [];
    const playlistIds: string[] = [];
    for (const play of plays) {
      if (!seenTracks.has(play.track.id) && recent.length < 16) {
        seenTracks.add(play.track.id);
        recent.push(fromRow(play.track));
      }
      if (play.contextType === "playlist" && play.contextId && !playlistIds.includes(play.contextId)) {
        playlistIds.push(play.contextId);
      }
    }

    // Playlists played lately that the listener can still open.
    const played = playlistIds.length
      ? await ctx.db.playlist.findMany({
          where: {
            id: { in: playlistIds.slice(0, 12) },
            OR: [{ ownerId: userId }, { collaborators: { some: { userId } } }, { visibility: "PUBLIC" }],
          },
          select: playlistCard,
        })
      : [];
    const byId = new Map(played.map((p) => [p.id, toCard(p)]));
    const jumpBackIn = playlistIds.map((id) => byId.get(id)).filter((p): p is HomePlaylist => Boolean(p));

    return { recent, jumpBackIn, playlists: library.map(toCard), likedCount, community: shared, trending: trend };
  }),
});
