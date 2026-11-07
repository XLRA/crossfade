"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock3, GripVertical, Pause, Play } from "lucide-react";

import { Equalizer } from "~/components/player/track-status";
import { Artwork } from "~/components/tracks/artwork";
import { LikeButton } from "~/components/tracks/likes";
import { ExplicitBadge, SourceIcon, SOURCE_LABEL } from "~/components/tracks/source-badge";
import { TrackContextMenu, TrackMenuButton } from "~/components/tracks/track-menu";
import { Avatar } from "~/components/ui/avatar";
import { cn } from "~/lib/cn";
import { formatAddedAt, formatDuration } from "~/lib/format";
import { useTapToPlay } from "~/lib/use-tap-to-play";
import { type RouterOutputs } from "~/trpc/react";

export type PlaylistData = RouterOutputs["playlist"]["byId"];
export type PlaylistEntry = PlaylistData["tracks"][number];

/*
 * Columns follow Spotify's playlist table: #, title, album, date added, duration. The table is a
 * container query context so columns drop out by the space the table actually has, which
 * changes when the side panels open, not by the window width. On a phone it's just the tracks.
 */
const COLUMNS =
  "grid-cols-[minmax(0,1fr)_auto] @md:grid-cols-[28px_minmax(0,1fr)_minmax(72px,auto)] @2xl:grid-cols-[28px_minmax(0,6fr)_minmax(0,4fr)_minmax(72px,auto)] @4xl:grid-cols-[28px_minmax(0,6fr)_minmax(0,4fr)_minmax(0,3fr)_minmax(72px,auto)] items-center gap-3 px-2 @md:gap-4 @md:px-4";

export function TrackTable({
  entries,
  canEdit,
  showAddedBy,
  playingEntryKey,
  isPlaying,
  sortable,
  playlistId,
  onPlay,
  onTogglePlay,
  onMove,
  onRemove,
}: {
  entries: PlaylistEntry[];
  canEdit: boolean;
  showAddedBy: boolean;
  /** trackKey of the current track when it's playing from this playlist. */
  playingEntryKey: string | null;
  isPlaying: boolean;
  /** False while the list is filtered, since positions in a filtered view are ambiguous. */
  sortable: boolean;
  playlistId: string;
  onPlay: (entry: PlaylistEntry) => void;
  onTogglePlay: () => void;
  onMove: (entryId: string, toIndex: number) => void;
  onRemove: (entry: PlaylistEntry) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const dragEnabled = canEdit && sortable;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const toIndex = entries.findIndex((e) => e.entryId === over.id);
    if (toIndex >= 0) onMove(String(active.id), toIndex);
  };

  return (
    <div className="@container" role="table" aria-label="Tracks" aria-rowcount={entries.length + 1}>
      <div
        role="row"
        className={cn(
          "hidden @md:grid",
          COLUMNS,
          "bg-ink-900 text-fg-muted sticky top-16 z-10 h-9 border-b border-white/[0.08] text-[13px]",
        )}
      >
        <span role="columnheader" className="text-right">
          #
        </span>
        <span role="columnheader">Title</span>
        <span role="columnheader" className="hidden @2xl:block">
          Album
        </span>
        <span role="columnheader" className="hidden @4xl:block">
          {showAddedBy ? "Added" : "Date added"}
        </span>
        <span role="columnheader" className="flex justify-end pr-10">
          <Clock3 className="size-4" aria-label="Duration" />
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={entries.map((e) => e.entryId)} strategy={verticalListSortingStrategy}>
          <div role="rowgroup" className="pt-2">
            {entries.map((entry, index) => {
              const current = playingEntryKey === `${entry.track.source}:${entry.track.sourceId}`;
              return (
                <TrackTableRow
                  key={entry.entryId}
                  entry={entry}
                  index={index}
                  current={current}
                  playing={current && isPlaying}
                  draggable={dragEnabled}
                  showAddedBy={showAddedBy}
                  playlistId={playlistId}
                  onPlay={() => (current ? onTogglePlay() : onPlay(entry))}
                  onRemove={canEdit ? () => onRemove(entry) : undefined}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function TrackTableRow({
  entry,
  index,
  current,
  playing,
  draggable,
  showAddedBy,
  playlistId,
  onPlay,
  onRemove,
}: {
  entry: PlaylistEntry;
  index: number;
  current: boolean;
  playing: boolean;
  draggable: boolean;
  showAddedBy: boolean;
  playlistId: string;
  onPlay: () => void;
  onRemove?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.entryId,
    disabled: !draggable,
  });
  const { track } = entry;
  const tap = useTapToPlay(onPlay);

  return (
    <TrackContextMenu track={track} options={{ onRemove, playlistId }}>
      <div
        ref={setNodeRef}
        role="row"
        aria-rowindex={index + 2}
        onDoubleClick={onPlay}
        onClick={tap}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        className={cn(
          "grid",
          COLUMNS,
          "group text-fg-muted relative h-14 rounded-md transition-colors focus-within:bg-white/[0.06] hover:bg-white/[0.06]",
          isDragging && "bg-ink-750 z-20 shadow-[var(--shadow-pop)]",
        )}
      >
        <div role="cell" className="relative hidden h-full items-center justify-end @md:flex">
          <span className={cn("tabular text-[15px] group-hover:invisible", current && "text-accent")}>
            {playing ? <Equalizer /> : index + 1}
          </span>
          <button
            type="button"
            onClick={onPlay}
            aria-label={playing ? `Pause ${track.title}` : `Play ${track.title} by ${track.artist}`}
            className="text-fg invisible absolute inset-y-0 right-0 grid w-6 place-items-center group-hover:visible focus-visible:visible"
          >
            {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
          </button>
        </div>

        <div role="cell" className="flex min-w-0 items-center gap-3">
          <Artwork src={track.artworkUrl} className="size-10 rounded" />
          <div className="min-w-0">
            <p className={cn("truncate text-[15px] leading-5", current ? "text-accent" : "text-fg")}>{track.title}</p>
            <p className="flex min-w-0 items-center gap-1.5 text-[13px] leading-5">
              <SourceIcon source={track.source} className="size-3.5 shrink-0" />
              <span className="sr-only">{SOURCE_LABEL[track.source]}:</span>
              {track.explicit && <ExplicitBadge />}
              <span className="group-hover:text-fg truncate">{track.artist}</span>
            </p>
          </div>
        </div>

        <div role="cell" className="hidden min-w-0 truncate text-[13px] @2xl:block">
          {track.album ?? (track.source === "YOUTUBE" ? "YouTube video" : "")}
        </div>

        <div role="cell" className="hidden min-w-0 items-center gap-2 text-[13px] @4xl:flex">
          {showAddedBy && entry.addedBy && (
            <Avatar
              src={entry.addedBy.image}
              name={entry.addedBy.name ?? entry.addedBy.username}
              seed={entry.addedBy.id}
              size={20}
            />
          )}
          <span className="truncate">{formatAddedAt(entry.addedAt)}</span>
        </div>

        <div role="cell" className="flex items-center justify-end gap-1">
          <LikeButton track={track} revealOnHover />
          <span className="tabular hidden w-11 text-right text-[13px] @md:inline">
            {formatDuration(track.durationMs)}
          </span>
          <TrackMenuButton
            track={track}
            options={{ onRemove, playlistId }}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
          />
        </div>

        {draggable && (
          <button
            type="button"
            aria-label={`Reorder ${track.title}`}
            className="text-fg-subtle hover:text-fg absolute top-1/2 -left-6 hidden -translate-y-1/2 cursor-grab touch-none opacity-0 group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing md:block"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        )}
      </div>
    </TrackContextMenu>
  );
}
