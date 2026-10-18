import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const trackRouter = createTRPCRouter({
  /**
   * Fills in a duration the catalog didn't have. Tracks added from a YouTube link without an API
   * key come from oEmbed, which has no duration; the player reports it once the video loads.
   * Only ever replaces "unknown", so a client can't change a duration that's already set.
   */
  reportDuration: protectedProcedure
    .input(
      z.object({
        source: z.enum(["SPOTIFY", "YOUTUBE"]),
        sourceId: z.string().min(1).max(64),
        durationMs: z
          .number()
          .int()
          .min(1_000)
          .max(12 * 60 * 60 * 1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.db.track.updateMany({
        where: { source: input.source, sourceId: input.sourceId, durationMs: 0 },
        data: { durationMs: input.durationMs },
      });
      return { updated: count > 0 };
    }),
});
