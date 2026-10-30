import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { rateLimit } from "~/server/rate-limit";

export const userRouter = createTRPCRouter({
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
