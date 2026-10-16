"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { plural } from "~/lib/format";
import { type TrackRef } from "~/lib/types";
import { api } from "~/trpc/react";

const refsOf = (tracks: TrackRef[]): TrackRef[] => tracks.map(({ source, sourceId }) => ({ source, sourceId }));

/**
 * Adding tracks to a playlist, with the feedback Spotify gives: a toast naming the playlist,
 * and "Already added" with an "Add anyway" button for duplicates.
 */
export function useAddToPlaylist() {
  const utils = api.useUtils();
  const add = api.playlist.addTracks.useMutation();

  return async function addToPlaylist(
    playlist: { id: string; title: string },
    tracks: TrackRef[],
    { allowDuplicates = false }: { allowDuplicates?: boolean } = {},
  ) {
    try {
      const result = await add.mutateAsync({ playlistId: playlist.id, tracks: refsOf(tracks), allowDuplicates });
      void utils.playlist.byId.invalidate({ id: playlist.id });
      void utils.playlist.library.invalidate();

      if (result.added > 0) {
        toast(
          result.added === 1 ? `Added to ${playlist.title}` : `Added ${plural(result.added, "track")} to ${playlist.title}`,
          result.duplicates > 0 ? { description: `${plural(result.duplicates, "track")} already there` } : undefined,
        );
      } else if (result.duplicates > 0) {
        toast(tracks.length === 1 ? "Already in this playlist" : "These are already in this playlist", {
          action: {
            label: "Add anyway",
            onClick: () => void addToPlaylist(playlist, tracks, { allowDuplicates: true }),
          },
        });
      }
      if (result.unavailable > 0) {
        toast.error(
          result.unavailable === 1
            ? "That track couldn't be found on its platform."
            : `${plural(result.unavailable, "track")} couldn't be found on their platform.`,
        );
      }
      return result;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't add to the playlist.");
      return null;
    }
  };
}

/** Creates a playlist (optionally seeded with tracks) and opens it. */
export function useCreatePlaylist() {
  const router = useRouter();
  const utils = api.useUtils();
  const create = api.playlist.create.useMutation();
  const addToPlaylist = useAddToPlaylist();

  return {
    pending: create.isPending,
    createPlaylist: async ({ tracks, open = true }: { tracks?: TrackRef[]; open?: boolean } = {}) => {
      try {
        const playlist = await create.mutateAsync();
        if (tracks?.length) await addToPlaylist(playlist, tracks);
        void utils.playlist.library.invalidate();
        if (open) router.push(`/playlist/${playlist.id}`);
        return playlist;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't create the playlist.");
        return null;
      }
    },
  };
}
