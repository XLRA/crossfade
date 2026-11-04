import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { trackKey } from "~/lib/types";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { ensureTracks, fromRow } from "~/server/catalog";
import { rateLimit } from "~/server/rate-limit";

const trackRef = z.object({
  source: z.enum(["SPOTIFY", "YOUTUBE"]),
  sourceId: z.string().min(1).max(64),
});

/** Liked Songs holds at most this many; the page and the heart state read the newest ones. */
const MAX_LIKES = 5_000;

export const likesRouter = createTRPCRouter({
  /** Keys ("SPOTIFY:<id>") of every liked track, so heart buttons anywhere can show their state. */
  keys: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.trackLike.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { likedAt: "desc" },
      take: MAX_LIKES,
      select: { track: { select: { source: true, sourceId: true } } },
    });
    return rows.map((row) => trackKey(row.track));
  }),

  /** Liked Songs, newest first. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.trackLike.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { likedAt: "desc" },
      take: MAX_LIKES,
      select: { likedAt: true, track: true },
    });
    return rows.map((row) => ({ likedAt: row.likedAt, track: fromRow(row.track) }));
  }),

  set: protectedProcedure.input(z.object({ track: trackRef, liked: z.boolean() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    if (!rateLimit(`like:${userId}`, 120, 60_000)) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Slow down a little and try again." });
    }

    if (!input.liked) {
      await ctx.db.trackLike.deleteMany({
        where: { userId, track: { source: input.track.source, sourceId: input.track.sourceId } },
      });
      return { liked: false };
    }

    const row = (await ensureTracks([input.track])).get(trackKey(input.track));
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "That track couldn't be found on its platform." });
    if ((await ctx.db.trackLike.count({ where: { userId } })) >= MAX_LIKES) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Liked Songs holds up to ${MAX_LIKES.toLocaleString("en-US")} tracks.`,
      });
    }
    await ctx.db.trackLike.upsert({
      where: { userId_trackId: { userId, trackId: row.id } },
      create: { userId, trackId: row.id },
      update: {},
    });
    return { liked: true };
  }),
});
