import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { coverImages, trackKey } from "~/lib/types";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { ensureTracks, fromRow } from "~/server/catalog";
import { lockPlaylist, renumber, requireRole, touch } from "~/server/playlists";

export const MAX_PLAYLIST_TRACKS = 2_000;

const trackRef = z.object({
  source: z.enum(["SPOTIFY", "YOUTUBE"]),
  sourceId: z.string().min(1).max(64),
});

const title = z
  .string()
  .trim()
  .min(1, "Give the playlist a name.")
  .max(100, "Keep the name under 100 characters.");

const description = z.string().trim().max(300, "Keep the description under 300 characters.");

export const playlistRouter = createTRPCRouter({
  /** The signed-in user's playlists for the sidebar, most recently changed first. */
  library: protectedProcedure.query(async ({ ctx }) => {
    const playlists = await ctx.db.playlist.findMany({
      where: { ownerId: ctx.session.user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        owner: { select: { name: true, username: true } },
        _count: { select: { tracks: true } },
        tracks: {
          orderBy: { position: "asc" },
          take: 12,
          select: { track: { select: { artworkUrl: true } } },
        },
      },
    });
    return playlists.map((p) => ({
      id: p.id,
      title: p.title,
      updatedAt: p.updatedAt,
      ownerName: p.owner.name ?? p.owner.username ?? "Unknown",
      trackCount: p._count.tracks,
      covers: coverImages(p.tracks.map((t) => t.track.artworkUrl)),
    }));
  }),

  byId: publicProcedure.input(z.object({ id: z.string().min(1).max(40) })).query(async ({ ctx, input }) => {
    const role = await requireRole(input.id, ctx.session?.user.id, "viewer");
    const playlist = await ctx.db.playlist.findUniqueOrThrow({
      where: { id: input.id },
      select: {
        id: true,
        title: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, username: true, image: true } },
        tracks: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            position: true,
            addedAt: true,
            addedBy: { select: { id: true, name: true, username: true, image: true } },
            track: true,
          },
        },
      },
    });

    const tracks = playlist.tracks.map((entry) => ({
      entryId: entry.id,
      position: entry.position,
      addedAt: entry.addedAt,
      addedBy: entry.addedBy,
      track: fromRow(entry.track),
    }));

    return {
      id: playlist.id,
      title: playlist.title,
      description: playlist.description,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
      owner: playlist.owner,
      role,
      tracks,
      covers: coverImages(tracks.map((t) => t.track.artworkUrl)),
      totalDurationMs: tracks.reduce((sum, t) => sum + t.track.durationMs, 0),
    };
  }),

  create: protectedProcedure
    .input(z.object({ title: title.optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const count = await ctx.db.playlist.count({ where: { ownerId: ctx.session.user.id } });
      const playlist = await ctx.db.playlist.create({
        data: { ownerId: ctx.session.user.id, title: input?.title ?? `My playlist #${count + 1}` },
        select: { id: true, title: true },
      });
      return playlist;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), title, description: description.optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireRole(input.id, ctx.session.user.id, "owner");
      return ctx.db.playlist.update({
        where: { id: input.id },
        // An emptied description is stored as null, not "".
        data: { title: input.title, description: input.description === "" ? null : (input.description ?? null) },
        select: { id: true, title: true, description: true },
      });
    }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await requireRole(input.id, ctx.session.user.id, "owner");
    await ctx.db.playlist.delete({ where: { id: input.id } });
    return { id: input.id };
  }),

  /**
   * Appends tracks. Tracks already in the playlist are skipped unless `allowDuplicates`, and the
   * response says how many, so the UI can offer "Add anyway".
   */
  addTracks: protectedProcedure
    .input(
      z.object({
        playlistId: z.string(),
        tracks: z.array(trackRef).min(1).max(100),
        allowDuplicates: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireRole(input.playlistId, ctx.session.user.id, "editor");
      const catalog = await ensureTracks(input.tracks);

      const wanted = input.tracks
        .map((ref) => catalog.get(trackKey(ref)))
        .filter((row): row is NonNullable<typeof row> => Boolean(row));
      const unavailable = input.tracks.length - wanted.length;

      return ctx.db.$transaction(async (tx) => {
        await lockPlaylist(tx, input.playlistId);
        const count = await tx.playlistTrack.count({ where: { playlistId: input.playlistId } });

        let toAdd = wanted;
        if (!input.allowDuplicates) {
          const present = await tx.playlistTrack.findMany({
            where: { playlistId: input.playlistId, trackId: { in: wanted.map((t) => t.id) } },
            select: { trackId: true },
          });
          const seen = new Set(present.map((p) => p.trackId));
          toAdd = wanted.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
        }
        if (count + toAdd.length > MAX_PLAYLIST_TRACKS) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Playlists can hold up to ${MAX_PLAYLIST_TRACKS.toLocaleString("en-US")} tracks.`,
          });
        }

        if (toAdd.length > 0) {
          await tx.playlistTrack.createMany({
            data: toAdd.map((track, i) => ({
              playlistId: input.playlistId,
              trackId: track.id,
              position: count + i,
              addedById: ctx.session.user.id,
            })),
          });
          await touch(tx, input.playlistId);
        }
        return { added: toAdd.length, duplicates: wanted.length - toAdd.length, unavailable };
      });
    }),

  removeEntries: protectedProcedure
    .input(z.object({ playlistId: z.string(), entryIds: z.array(z.string()).min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      await requireRole(input.playlistId, ctx.session.user.id, "editor");
      return ctx.db.$transaction(async (tx) => {
        await lockPlaylist(tx, input.playlistId);
        const { count } = await tx.playlistTrack.deleteMany({
          where: { playlistId: input.playlistId, id: { in: input.entryIds } },
        });
        if (count > 0) {
          await renumber(tx, input.playlistId);
          await touch(tx, input.playlistId);
        }
        return { removed: count };
      });
    }),

  /** Moves one entry to `toIndex`, shifting the ones in between. */
  moveEntry: protectedProcedure
    .input(z.object({ playlistId: z.string(), entryId: z.string(), toIndex: z.number().int().min(0) }))
    .mutation(async ({ ctx, input }) => {
      await requireRole(input.playlistId, ctx.session.user.id, "editor");
      await ctx.db.$transaction(async (tx) => {
        await lockPlaylist(tx, input.playlistId);
        const entry = await tx.playlistTrack.findFirst({
          where: { id: input.entryId, playlistId: input.playlistId },
          select: { position: true },
        });
        if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "That track isn't in the playlist anymore." });
        const count = await tx.playlistTrack.count({ where: { playlistId: input.playlistId } });
        const from = entry.position;
        const to = Math.min(input.toIndex, count - 1);
        if (from === to) return;

        if (to > from) {
          await tx.playlistTrack.updateMany({
            where: { playlistId: input.playlistId, position: { gt: from, lte: to } },
            data: { position: { decrement: 1 } },
          });
        } else {
          await tx.playlistTrack.updateMany({
            where: { playlistId: input.playlistId, position: { gte: to, lt: from } },
            data: { position: { increment: 1 } },
          });
        }
        await tx.playlistTrack.update({ where: { id: input.entryId }, data: { position: to } });
        await touch(tx, input.playlistId);
      });
      return { ok: true };
    }),
});
