"use client";

import { TRPCClientError } from "@trpc/client";
import { ImagePlus, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PlaylistCover } from "~/components/playlists/playlist-cover";
import { Artwork } from "~/components/tracks/artwork";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { COVER_ACCEPT, CoverImageError, prepareCover, toBase64 } from "~/lib/cover-image";
import { type AppRouter } from "~/server/api/root";
import { api } from "~/trpc/react";

type Details = { id: string; title: string; description: string | null; customCover: string | null };

/** What happens to the cover on save. */
type CoverChange = { kind: "keep" } | { kind: "new"; blob: Blob; preview: string } | { kind: "remove" };

export function EditDetailsDialog({
  open,
  onOpenChange,
  playlist,
  mosaic,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlist: Details;
  /** The cover made from track artwork, shown when there's no uploaded image. */
  mosaic: string[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <EditDetailsForm playlist={playlist} mosaic={mosaic} onDone={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function EditDetailsForm({ playlist, mosaic, onDone }: { playlist: Details; mosaic: string[]; onDone: () => void }) {
  const [title, setTitle] = useState(playlist.title);
  const [description, setDescription] = useState(playlist.description ?? "");
  const [cover, setCover] = useState<CoverChange>({ kind: "keep" });
  const [coverError, setCoverError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const utils = api.useUtils();
  const update = api.playlist.update.useMutation();
  const upload = api.playlist.setCover.useMutation();
  const removeCover = api.playlist.removeCover.useMutation();

  // Previews are object URLs; let each one go once it's replaced or the dialog closes.
  useEffect(() => {
    if (cover.kind !== "new") return;
    return () => URL.revokeObjectURL(cover.preview);
  }, [cover]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setCoverError(null);
    setPreparing(true);
    try {
      const blob = await prepareCover(file);
      setCover({ kind: "new", blob, preview: URL.createObjectURL(blob) });
    } catch (error) {
      setCoverError(error instanceof CoverImageError ? error.message : "That image couldn't be used. Try another one.");
    } finally {
      setPreparing(false);
    }
  };

  const shownImage = cover.kind === "new" ? cover.preview : cover.kind === "remove" ? null : playlist.customCover;

  const save = async () => {
    setSaving(true);
    try {
      const saved = await update.mutateAsync({ id: playlist.id, title, description });
      let customCover = playlist.customCover;
      if (cover.kind === "new") {
        ({ customCover } = await upload.mutateAsync({ id: playlist.id, jpeg: await toBase64(cover.blob) }));
      } else if (cover.kind === "remove" && playlist.customCover) {
        ({ customCover } = await removeCover.mutateAsync({ id: playlist.id }));
      }
      utils.playlist.byId.setData({ id: playlist.id }, (old) =>
        old ? { ...old, ...saved, customCover, covers: customCover ? [customCover] : mosaic } : old,
      );
      if (cover.kind !== "keep") {
        // Every list that shows this playlist's cover.
        void utils.playlist.library.invalidate();
        void utils.home.feed.invalidate();
        void utils.user.profile.invalidate();
      } else {
        void utils.playlist.library.invalidate();
      }
      onDone();
    } catch (error) {
      const invalid = error instanceof TRPCClientError && Boolean((error as TRPCClientError<AppRouter>).data?.zodError);
      toast.error(
        invalid
          ? "Check the name and description."
          : error instanceof Error
            ? error.message
            : "Couldn't save your changes.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent title="Edit details">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]"
      >
        <div className="flex flex-col items-center sm:row-span-2 sm:items-start">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void pick(e.dataTransfer.files[0]);
            }}
            disabled={preparing || saving}
            aria-label="Choose a cover photo"
            aria-describedby={coverError ? "cover-error" : undefined}
            className="group relative size-[180px] shrink-0 overflow-hidden rounded-md shadow-[var(--shadow-art)]"
          >
            {shownImage ? (
              <Artwork src={shownImage} eager className="size-full" />
            ) : (
              <PlaylistCover covers={mosaic} className="size-full" />
            )}
            <span
              aria-hidden
              className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-sm font-semibold transition-opacity duration-200 ${
                preparing ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
              }`}
            >
              {preparing ? (
                <LoaderCircle className="size-9 animate-spin" strokeWidth={1.6} />
              ) : (
                <ImagePlus className="size-9" strokeWidth={1.6} />
              )}
              {preparing ? "Preparing" : "Choose photo"}
            </span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={COVER_ACCEPT}
            tabIndex={-1}
            aria-hidden
            className="sr-only"
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="mt-2 flex h-5 items-center gap-3 text-xs font-semibold">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="text-fg-muted hover:text-fg sm:hidden"
            >
              Choose photo
            </button>
            {shownImage && (
              <button
                type="button"
                onClick={() => {
                  setCover({ kind: "remove" });
                  setCoverError(null);
                }}
                className="text-fg-muted hover:text-fg hover:underline"
              >
                Remove photo
              </button>
            )}
          </div>
          {coverError && (
            <p id="cover-error" role="alert" className="text-danger mt-1 max-w-[180px] text-xs leading-snug">
              {coverError}
            </p>
          )}
        </div>

        <label className="block">
          <span className="text-fg-muted mb-1.5 flex justify-between text-xs font-semibold">
            Name <span className="tabular font-normal">{title.length}/100</span>
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            required
            autoFocus
            className="bg-ink-750 h-11 w-full rounded-md px-3 text-[15px] outline-none focus:ring-2 focus:ring-white/40"
          />
        </label>
        <label className="flex flex-col">
          <span className="text-fg-muted mb-1.5 flex justify-between text-xs font-semibold">
            Description <span className="tabular font-normal">{description.length}/300</span>
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            rows={4}
            placeholder="Add an optional description"
            className="bg-ink-750 placeholder:text-fg-subtle w-full flex-1 resize-none rounded-md px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/40"
          />
        </label>

        <div className="flex items-end justify-between gap-4 sm:col-span-2">
          <p className="text-fg-subtle text-[11px] leading-snug">
            Photos are cropped to a square. Only upload images you have the right to use.
          </p>
          <Button type="submit" size="lg" disabled={saving || preparing || !title.trim()}>
            {saving ? "Saving" : "Save"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
