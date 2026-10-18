"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { api } from "~/trpc/react";

export function EditDetailsDialog({
  open,
  onOpenChange,
  playlist,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlist: { id: string; title: string; description: string | null };
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <EditDetailsForm playlist={playlist} onDone={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function EditDetailsForm({
  playlist,
  onDone,
}: {
  playlist: { id: string; title: string; description: string | null };
  onDone: () => void;
}) {
  const [title, setTitle] = useState(playlist.title);
  const [description, setDescription] = useState(playlist.description ?? "");
  const utils = api.useUtils();
  const update = api.playlist.update.useMutation({
    onSuccess: (saved) => {
      utils.playlist.byId.setData({ id: playlist.id }, (old) => (old ? { ...old, ...saved } : old));
      void utils.playlist.library.invalidate();
      onDone();
    },
    onError: (error) => toast.error(error.data?.zodError ? "Check the name and description." : error.message),
  });

  return (
    <DialogContent title="Edit details">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({ id: playlist.id, title, description });
        }}
        className="space-y-4"
      >
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
        <label className="block">
          <span className="text-fg-muted mb-1.5 flex justify-between text-xs font-semibold">
            Description <span className="tabular font-normal">{description.length}/300</span>
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            rows={4}
            placeholder="Add an optional description"
            className="bg-ink-750 placeholder:text-fg-subtle w-full resize-none rounded-md px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/40"
          />
        </label>
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={update.isPending || !title.trim()}>
            Save
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
