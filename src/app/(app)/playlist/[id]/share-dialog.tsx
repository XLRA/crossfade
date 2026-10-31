"use client";

import { Globe, Link2, LoaderCircle, Lock, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { absoluteUrl } from "~/lib/base-path";
import { cn } from "~/lib/cn";
import { api } from "~/trpc/react";
import { type PlaylistData } from "./track-table";

type Person = PlaylistData["owner"];
type Visibility = PlaylistData["visibility"];

export function ShareDialog({
  open,
  onOpenChange,
  playlist,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlist: PlaylistData;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <ShareForm playlist={playlist} />}
    </Dialog>
  );
}

function ShareForm({ playlist }: { playlist: PlaylistData }) {
  const utils = api.useUtils();
  const patch = (update: (old: PlaylistData) => PlaylistData) =>
    utils.playlist.byId.setData({ id: playlist.id }, (old) => (old ? update(old) : old));
  const resync = () => {
    void utils.playlist.byId.invalidate({ id: playlist.id });
    void utils.playlist.library.invalidate();
  };

  const visibility = api.playlist.setVisibility.useMutation({
    onMutate: ({ visibility }) => patch((old) => ({ ...old, visibility })),
    onError: (error) => toast.error(error.message),
    onSettled: resync,
  });

  const copyLink = () => {
    void navigator.clipboard
      .writeText(absoluteUrl(`/playlist/${playlist.id}`))
      .then(() =>
        toast(
          "Link copied",
          playlist.visibility === "PRIVATE"
            ? { description: "It only opens for you and your collaborators while the playlist is private." }
            : undefined,
        ),
      )
      .catch(() => toast.error("Couldn't copy the link."));
  };

  return (
    <DialogContent title="Share playlist" description={playlist.title} className="max-w-[560px]">
      <h3 className="text-sm font-semibold">Who can listen</h3>
      <div role="radiogroup" aria-label="Who can listen" className="mt-2 grid gap-2 sm:grid-cols-2">
        <VisibilityOption
          value="PRIVATE"
          current={playlist.visibility}
          icon={<Lock className="size-4" />}
          title="Private"
          body="Only you and your collaborators."
          onSelect={(value) => visibility.mutate({ id: playlist.id, visibility: value })}
        />
        <VisibilityOption
          value="PUBLIC"
          current={playlist.visibility}
          icon={<Globe className="size-4" />}
          title="Public"
          body="Anyone with the link, and it shows on your profile."
          onSelect={(value) => visibility.mutate({ id: playlist.id, visibility: value })}
        />
      </div>

      <Collaborators playlist={playlist} patch={patch} resync={resync} />

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/[0.08] pt-5">
        <p className="text-fg-subtle text-xs">Collaborators can add, remove and reorder tracks.</p>
        <Button variant="outline" size="sm" onClick={copyLink}>
          <Link2 className="size-4" />
          Copy link
        </Button>
      </div>
    </DialogContent>
  );
}

function VisibilityOption({
  value,
  current,
  icon,
  title,
  body,
  onSelect,
}: {
  value: Visibility;
  current: Visibility;
  icon: React.ReactNode;
  title: string;
  body: string;
  onSelect: (value: Visibility) => void;
}) {
  const checked = value === current;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={() => !checked && onSelect(value)}
      className={cn(
        "flex items-start gap-3 rounded-lg p-3 text-left ring-1 transition-[background-color,box-shadow]",
        checked ? "bg-white/[0.07] ring-white/70" : "ring-white/[0.12] hover:bg-white/[0.04] hover:ring-white/30",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
          checked ? "bg-fg text-ink-950" : "text-fg-muted bg-white/[0.08]",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="text-fg-muted block text-[13px] leading-snug">{body}</span>
      </span>
    </button>
  );
}

// --- Collaborators -------------------------------------------------------------------------------

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function Collaborators({
  playlist,
  patch,
  resync,
}: {
  playlist: PlaylistData;
  patch: (update: (old: PlaylistData) => PlaylistData) => void;
  resync: () => void;
}) {
  const inputId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const typed = query.trim().replace(/^@/, "");
  const debounced = useDebounced(typed, 180);

  const memberIds = new Set([playlist.owner.id, ...playlist.collaborators.map((c) => c.id)]);
  const search = api.user.search.useQuery({ q: debounced }, { enabled: debounced.length >= 2, staleTime: 30_000 });
  const suggestions = (search.data ?? []).filter((u) => !memberIds.has(u.id));
  const showSuggestions = typed.length >= 2 && suggestions.length > 0;

  const add = api.playlist.addCollaborator.useMutation({
    onSuccess: (user) => {
      patch((old) =>
        old.collaborators.some((c) => c.id === user.id) ? old : { ...old, collaborators: [...old.collaborators, user] },
      );
      setQuery("");
      toast(`${user.name ?? `@${user.username}`} can now edit this playlist`);
      inputRef.current?.focus();
    },
    onError: (error) => toast.error(error.message),
    onSettled: resync,
  });

  const remove = api.playlist.removeCollaborator.useMutation({
    onMutate: ({ userId }) =>
      patch((old) => ({ ...old, collaborators: old.collaborators.filter((c) => c.id !== userId) })),
    onError: (error) => toast.error(error.message),
    onSettled: resync,
  });

  const submit = (username: string) => {
    if (!username || add.isPending) return;
    add.mutate({ playlistId: playlist.id, username });
  };

  return (
    <section className="mt-6">
      <label htmlFor={inputId} className="text-sm font-semibold">
        Collaborators
      </label>
      <form
        className="relative mt-2"
        onSubmit={(e) => {
          e.preventDefault();
          const picked = showSuggestions ? suggestions[highlight] : undefined;
          submit(picked?.username ?? typed);
        }}
      >
        <div className="bg-ink-750 flex h-10 items-center rounded-md ring-1 ring-transparent focus-within:ring-white/40">
          <span className="text-fg-subtle pl-3" aria-hidden>
            @
          </span>
          <input
            ref={inputRef}
            id={inputId}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={(e) => {
              if (!showSuggestions) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((i) => (i + 1) % suggestions.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((i) => (i - 1 + suggestions.length) % suggestions.length);
              }
            }}
            placeholder="Add by username"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={showSuggestions}
            aria-controls={listId}
            aria-activedescendant={showSuggestions ? `${listId}-${highlight}` : undefined}
            className="placeholder:text-fg-subtle h-full min-w-0 flex-1 bg-transparent px-1 text-sm outline-none"
          />
          <Button type="submit" variant="light" size="sm" className="mr-1" disabled={!typed || add.isPending}>
            {add.isPending && <LoaderCircle className="size-3.5 animate-spin" />}
            Add
          </Button>
        </div>

        {showSuggestions && (
          <ul
            id={listId}
            role="listbox"
            aria-label="People"
            className="bg-ink-700 animate-pop-in absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg p-1 shadow-[var(--shadow-pop)]"
          >
            {suggestions.map((user, i) => (
              <li
                key={user.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === highlight}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  // Keep focus in the input; the click picks the person.
                  e.preventDefault();
                  submit(user.username ?? "");
                }}
                className={cn(
                  "flex cursor-default items-center gap-3 rounded-[5px] px-2 py-1.5",
                  i === highlight && "bg-white/[0.08]",
                )}
              >
                <Avatar src={user.image} name={user.name ?? user.username} seed={user.id} size={28} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{user.name ?? user.username}</span>
                  <span className="text-fg-muted block truncate text-xs">@{user.username}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </form>

      <ul className="mt-3 space-y-0.5">
        <PersonRow person={playlist.owner} label="Owner" />
        {playlist.collaborators.map((person) => (
          <PersonRow
            key={person.id}
            person={person}
            action={
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove ${person.name ?? person.username}`}
                onClick={() => remove.mutate({ playlistId: playlist.id, userId: person.id })}
              >
                <X className="size-4" />
                Remove
              </Button>
            }
          />
        ))}
      </ul>
      {playlist.collaborators.length === 0 && (
        <p className="text-fg-subtle mt-2 text-xs">
          Add a friend by their Crossfade username. They&apos;ll find the playlist in their library.
        </p>
      )}
    </section>
  );
}

function PersonRow({ person, label, action }: { person: Person; label?: string; action?: React.ReactNode }) {
  return (
    <li className="flex min-h-12 items-center gap-3 rounded-md px-1 py-1.5">
      <Avatar src={person.image} name={person.name ?? person.username} seed={person.id} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{person.name ?? person.username}</p>
        {person.username && <p className="text-fg-muted truncate text-xs">@{person.username}</p>}
      </div>
      {label && <span className="text-fg-subtle pr-2 text-xs">{label}</span>}
      {action}
    </li>
  );
}
