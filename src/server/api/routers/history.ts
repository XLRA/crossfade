import { z } from "zod";

import { trackKey } from "~/lib/types";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { ensureTracks } from "~/server/catalog";
import { rateLimit } from "~/server/rate-limit";

/** Listens older than this are pruned now and then; the home page only looks at recent ones. */
const KEEP_DAYS = 180;

export const historyRouter = createTRPCRouter({
  /**
   * Records a listen. The player calls this once per track, after 30 seconds of playback (or
   * half of a shorter track), the same bar streaming services use to count a play.
   */
  record: protectedProcedure
    .input(
      z.object({
        track: z.object({ source: z.enum(["SPOTIFY", "YOUTUBE"]), sourceId: z.string().min(1).max(64) }),
        context: z
          .object({
            type: z.enum(["playlist", "search", "link", "liked", "history", "profile", "home"]),
            id: z.string().max(64).optional(),
          })
          .nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      // Nobody listens to more than a few hundred tracks an hour; past that it's a script.
      if (!rateLimit(`play:${userId}`, 300, 60 * 60_000)) return { recorded: false };

      const row = (await ensureTracks([input.track])).get(trackKey(input.track));
      if (!row) return { recorded: false };

      await ctx.db.play.create({
        data: {
          userId,
          trackId: row.id,
          contextType: input.context?.type ?? null,
          contextId: input.context?.id ?? null,
        },
      });
      if (Math.random() < 0.02) {
        await ctx.db.play.deleteMany({
          where: { userId, playedAt: { lt: new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60_000) } },
        });
      }
      return { recorded: true };
    }),
});
