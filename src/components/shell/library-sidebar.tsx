import { LibraryBig, Plus } from "lucide-react";

export function LibrarySidebar() {
  return (
    <aside className="hidden w-[284px] shrink-0 flex-col overflow-hidden rounded-[var(--radius-panel)] bg-ink-900 md:flex lg:w-[304px]">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="flex items-center gap-2.5 text-[15px] font-semibold text-fg">
          <LibraryBig className="size-5 text-fg-muted" aria-hidden />
          Your library
        </h2>
        <button
          type="button"
          aria-label="Create playlist"
          className="grid size-8 place-items-center rounded-full text-fg-muted transition-colors hover:bg-ink-800 hover:text-fg"
        >
          <Plus className="size-5" />
        </button>
      </div>
      <div className="scroll-area flex-1 px-2 pb-2">
        <div className="m-2 rounded-lg bg-ink-850 p-4">
          <p className="text-[15px] font-semibold">Make a playlist that mixes both</p>
          <p className="mt-1 text-sm text-fg-muted">
            Spotify tracks and YouTube videos can sit in the same list.
          </p>
        </div>
      </div>
    </aside>
  );
}
