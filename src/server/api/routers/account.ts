import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { Prisma } from "../../../../generated/prisma";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { isReservedUsername, USERNAME_PATTERN } from "~/server/auth/username";
import { ConnectionError, connectionsFor, getAccessToken } from "~/server/connections";

const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Usernames need at least 3 characters.")
  .max(24, "Keep usernames to 24 characters.")
  .regex(USERNAME_PATTERN, "Use letters, numbers, dots and underscores, starting and ending with a letter or number.")
  .refine((value) => !isReservedUsername(value), "That username is reserved.");

const displayName = z.string().trim().min(1, "Your name can't be empty.").max(60, "Keep your name to 60 characters.");

export const accountRouter = createTRPCRouter({
  connections: protectedProcedure.query(({ ctx }) => connectionsFor(ctx.session.user.id)),

  updateProfile: protectedProcedure
    .input(z.object({ name: displayName, username }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.user.update({
          where: { id: ctx.session.user.id },
          data: { name: input.name, username: input.username },
          select: { name: true, username: true },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "That username is taken." });
        }
        throw error;
      }
    }),

  /**
   * Unlinks Spotify or Google. The last way to sign in can't be removed, or the account would be
   * locked out. (Developer-login accounts don't need one.)
   */
  disconnect: protectedProcedure
    .input(z.object({ provider: z.enum(["spotify", "google"]) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const [accounts, user] = await Promise.all([
        ctx.db.account.findMany({ where: { userId }, select: { id: true, provider: true } }),
        ctx.db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } }),
      ]);
      const target = accounts.find((a) => a.provider === input.provider);
      if (!target) return { disconnected: false };

      const devAccount = user.email?.endsWith("@dev.crossfade.local") ?? false;
      if (accounts.length === 1 && !devAccount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This is how you sign in. Connect the other service first, then you can remove this one.",
        });
      }
      await ctx.db.account.delete({ where: { id: target.id } });
      return { disconnected: true };
    }),

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
