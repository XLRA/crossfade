import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { coverImages } from "~/lib/types";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { rateLimit } from "~/server/rate-limit";

export const userRouter = createTRPCRouter({
  /** A profile page: the person and their public playlists. Private ones never show here. */
  profile: publicProcedure
    .input(z.object({ username: z.string().trim().toLowerCase().min(1).max(32) }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { username: input.username },
        select: { id: true, name: true, username: true, image: true },
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: `No one goes by @${input.username}.` });

      const playlists = await ctx.db.playlist.findMany({
        where: { ownerId: user.id, visibility: "PUBLIC" },
        orderBy: { updatedAt: "desc" },
        take: 60,
        select: {
          id: true,
          title: true,
          _count: { select: { tracks: true } },
          tracks: { orderBy: { position: "asc" }, take: 12, select: { track: { select: { artworkUrl: true } } } },
        },
      });

      return {
        user,
        isYou: ctx.session?.user.id === user.id,
        playlists: playlists.map((p) => ({
          id: p.id,
          title: p.title,
          trackCount: p._count.tracks,
          covers: coverImages(p.tracks.map((t) => t.track.artworkUrl)),
        })),
      };
    }),

  /**
   * People to share a playlist with. Matches the start of a username or name, so it finds the
   * person you mean without working as a directory of everyone on the site.
   */
  search: protectedProcedure.input(z.object({ q: z.string().trim().max(40) })).query(async ({ ctx, input }) => {
    const q = input.q.replace(/^@/, "");
    if (q.length < 2) return [];
    if (!rateLimit(`user-search:${ctx.session.user.id}`, 60, 60_000)) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Slow down a little and try again." });
    }
    return ctx.db.user.findMany({
      where: {
        id: { not: ctx.session.user.id },
        username: { not: null },
        OR: [{ username: { startsWith: q.toLowerCase() } }, { name: { startsWith: q } }],
      },
      orderBy: { username: "asc" },
      take: 6,
      select: { id: true, name: true, username: true, image: true },
    });
  }),
});
