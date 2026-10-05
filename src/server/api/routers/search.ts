import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { parseMusicLink } from "~/lib/links";
import { type TrackData } from "~/lib/types";
import { settle, youtube } from "~/server/adapters";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { clientIp, rateLimit } from "~/server/rate-limit";

async function resolveLink(q: string): Promise<TrackData | null> {
  const link = parseMusicLink(q);
  if (!link || link.kind !== "track") return null;
  if (link.source === "YOUTUBE") {
    if (youtube.configured) {
      const [track] = await youtube.getTracks([link.id]).catch(() => []);
      if (track) return track;
    }
    return youtube.oembed(link.id).catch(() => null);
  }
  return null;
}

export const searchRouter = createTRPCRouter({
  tracks: publicProcedure
    .input(z.object({ q: z.string().trim().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const who = ctx.session?.user.id ?? clientIp(ctx.headers);
      if (!rateLimit(`search:${who}`, 40, 60_000)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Slow down a little and try again." });
      }

      if (parseMusicLink(input.q)) {
        const link = await resolveLink(input.q);
        return { query: input.q, isLink: true as const, link, youtube: null };
      }

      const results = await settle("YOUTUBE", () => youtube.search(input.q, 12));
      return { query: input.q, isLink: false as const, link: null, youtube: results };
    }),
});
