"use client";

import { Ellipsis, ExternalLink, Link2, ListEnd, ListPlus, ListStart, LogIn, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAddToPlaylist, useCreatePlaylist } from "~/components/playlists/use-playlist-actions";
import { useViewer } from "~/components/providers/viewer-provider";
import { SOURCE_LABEL } from "~/components/tracks/source-badge";
import { IconButton } from "~/components/ui/button";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "~/components/ui/menu";
import { cn } from "~/lib/cn";
import { sourceUrl } from "~/lib/links";
import { usePlayer } from "~/lib/player/store";
import { useSignInHref } from "~/lib/sign-in";
import { type TrackData } from "~/lib/types";
import { api } from "~/trpc/react";

export type TrackMenuOptions = {
  /** Set when the track is shown inside a playlist the viewer can edit. */
  onRemove?: () => void;
  /** Hide this playlist from "Add to playlist" (the one the track is already being shown in). */
  playlistId?: string;
};

type Kind = "dropdown" | "context";

const PARTS = {
  dropdown: {
    Item: MenuItem,
    Separator: MenuSeparator,
    Sub: MenuSub,
    SubTrigger: MenuSubTrigger,
    SubContent: MenuSubContent,
  },
  context: {
    Item: ContextMenuItem,
    Separator: ContextMenuSeparator,
    Sub: ContextMenuSub,
    SubTrigger: ContextMenuSubTrigger,
    SubContent: ContextMenuSubContent,
  },
} as const;

/** The same track menu whether it's opened from the "…" button or with a right click. */
function TrackMenuItems({ kind, track, options }: { kind: Kind; track: TrackData; options: TrackMenuOptions }) {
  const { Item, Separator } = PARTS[kind];
  const viewer = useViewer();
  const router = useRouter();
  const signInHref = useSignInHref();

  return (
    <>
      {viewer ? (
        <AddToPlaylistSub kind={kind} track={track} exclude={options.playlistId} />
      ) : (
        <Item onSelect={() => router.push(signInHref)}>
          <LogIn />
          Sign in to save to a playlist
        </Item>
      )}
      <Item
        onSelect={() => {
          usePlayer.getState().addToQueue([track]);
          toast("Added to queue");
        }}
      >
        <ListEnd />
        Add to queue
      </Item>
      <Item
        onSelect={() => {
          usePlayer.getState().playNext([track]);
          toast("Playing next");
        }}
      >
        <ListStart />
        Play next
      </Item>
      {options.onRemove && (
        <>
          <Separator />
          <Item destructive onSelect={options.onRemove}>
            <Trash2 />
            Remove from this playlist
          </Item>
        </>
      )}
      <Separator />
      <Item onSelect={() => window.open(sourceUrl(track), "_blank", "noopener,noreferrer")}>
        <ExternalLink />
        Open on {SOURCE_LABEL[track.source]}
      </Item>
      <Item
        onSelect={() => {
          void navigator.clipboard
            .writeText(sourceUrl(track))
            .then(() => toast("Link copied"))
            .catch(() => toast.error("Couldn't copy the link."));
        }}
      >
        <Link2 />
        Copy {SOURCE_LABEL[track.source]} link
      </Item>
    </>
  );
}

function AddToPlaylistSub({ kind, track, exclude }: { kind: Kind; track: TrackData; exclude?: string }) {
  const { Item, Separator, Sub, SubTrigger, SubContent } = PARTS[kind];
  const library = api.playlist.library.useQuery(undefined, { staleTime: 30_000 });
  const addToPlaylist = useAddToPlaylist();
  const { createPlaylist } = useCreatePlaylist();
  const playlists = (library.data ?? []).filter((p) => p.id !== exclude);

  return (
    <Sub>
      <SubTrigger>
        <ListPlus />
        Add to playlist
      </SubTrigger>
      <SubContent className="max-h-[420px] w-[260px] overflow-y-auto">
        <Item onSelect={() => void createPlaylist({ tracks: [track], open: false })}>
          <Plus />
          New playlist
        </Item>
        {playlists.length > 0 && <Separator />}
        {library.isLoading && <p className="text-fg-subtle px-3 py-2 text-[13px]">Loading your playlists…</p>}
        {playlists.map((playlist) => (
          <Item key={playlist.id} onSelect={() => void addToPlaylist(playlist, [track])}>
            <span className="truncate">{playlist.title}</span>
          </Item>
        ))}
      </SubContent>
    </Sub>
  );
}

export function TrackMenuButton({
  track,
  options = {},
  className,
}: {
  track: TrackData;
  options?: TrackMenuOptions;
  className?: string;
}) {
  return (
    <Menu modal={false}>
      <MenuTrigger asChild>
        <IconButton
          label={`More options for ${track.title}`}
          size="sm"
          tooltip={false}
          className={cn("data-[state=open]:text-fg data-[state=open]:opacity-100", className)}
        >
          <Ellipsis className="size-[18px]" />
        </IconButton>
      </MenuTrigger>
      <MenuContent align="end">
        <TrackMenuItems kind="dropdown" track={track} options={options} />
      </MenuContent>
    </Menu>
  );
}

/** Right-click menu around a row. The child must accept a ref and props (a DOM element). */
export function TrackContextMenu({
  track,
  options = {},
  children,
}: {
  track: TrackData;
  options?: TrackMenuOptions;
  children: React.ReactNode;
}) {
  return (
    <ContextMenuRoot modal={false}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <TrackMenuItems kind="context" track={track} options={options} />
      </ContextMenuContent>
    </ContextMenuRoot>
  );
}
