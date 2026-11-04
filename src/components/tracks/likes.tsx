"use client";

import { Heart } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

import { useViewer } from "~/components/providers/viewer-provider";
import { IconButton } from "~/components/ui/button";
import { cn } from "~/lib/cn";
import { type TrackRef, trackKey } from "~/lib/types";
import { api } from "~/trpc/react";

// One Set per fetched list, shared by every heart on the page instead of one per row.
const sets = new WeakMap<string[], Set<string>>();
function toSet(keys: string[]): Set<string> {
  let set = sets.get(keys);
  if (!set) {
    set = new Set(keys);
    sets.set(keys, set);
  }
  return set;
}
const EMPTY = new Set<string>();

/** Keys of the viewer's liked tracks. Empty for guests. */
export function useLikedKeys(): Set<string> {
  const viewer = useViewer();
  const query = api.likes.keys.useQuery(undefined, { enabled: Boolean(viewer), staleTime: 5 * 60_000, select: toSet });
  return query.data ?? EMPTY;
}

/** Likes or unlikes a track, updating every heart right away and rolling back if it fails. */
export function useSetLiked() {
  const utils = api.useUtils();
  return useCallback(
    async (track: TrackRef, liked: boolean) => {
      const key = trackKey(track);
      await utils.likes.keys.cancel();
      const previous = utils.likes.keys.getData();
      utils.likes.keys.setData(undefined, (old = []) =>
        liked ? [key, ...old.filter((k) => k !== key)] : old.filter((k) => k !== key),
      );
      try {
        await utils.client.likes.set.mutate({ track: { source: track.source, sourceId: track.sourceId }, liked });
        toast(liked ? "Added to Liked Songs" : "Removed from Liked Songs");
      } catch (error) {
        utils.likes.keys.setData(undefined, previous);
        toast.error(error instanceof Error ? error.message : "Couldn't update Liked Songs.");
      } finally {
        void utils.likes.list.invalidate();
        void utils.home.feed.invalidate();
      }
    },
    [utils],
  );
}

/**
 * The heart. In lists it only shows on hover until the track is liked, like the save button in
 * other players; in the player bar it's always there. Renders nothing for guests.
 */
export function LikeButton({
  track,
  revealOnHover = false,
  className,
}: {
  track: TrackRef;
  revealOnHover?: boolean;
  className?: string;
}) {
  const viewer = useViewer();
  const liked = useLikedKeys().has(trackKey(track));
  const setLiked = useSetLiked();
  if (!viewer) return null;

  return (
    <IconButton
      label={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
      size="sm"
      active={liked}
      tooltip={!revealOnHover}
      onClick={() => void setLiked(track, !liked)}
      className={cn(
        revealOnHover && !liked && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        className,
      )}
    >
      <Heart className={cn("size-4", liked && "fill-current")} />
    </IconButton>
  );
}

/** The Liked Songs cover: a warm gradient with a heart, used in the sidebar, home and its page. */
export function LikedCover({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center bg-[linear-gradient(135deg,#ffc53d_0%,#ff7a45_55%,#d9345a_100%)]",
        className,
      )}
    >
      <Heart className="text-accent-ink size-[42%] fill-current" aria-hidden />
    </div>
  );
}
