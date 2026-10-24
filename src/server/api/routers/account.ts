import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { ConnectionError, getAccessToken } from "~/server/connections";

export const accountRouter = createTRPCRouter({
  /**
   * A Spotify access token for the Web Playback SDK, which runs in the browser and has to have
   * one. Null when the user hasn't connected Spotify (or the connection has lapsed); the player
   * then uses the embed.
   */
  spotifyPlaybackToken: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { token, expiresAt } = await getAccessToken(ctx.session.user.id, "spotify", { scope: "streaming" });
      return { accessToken: token, expiresAt };
    } catch (error) {
      if (error instanceof ConnectionError) {
        if (error.code === "upstream") throw new TRPCError({ code: "BAD_GATEWAY", message: error.message });
        return null;
      }
      throw error;
    }
  }),
});
