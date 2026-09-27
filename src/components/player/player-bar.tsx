import { Pause, Repeat, Shuffle, SkipBack, SkipForward } from "lucide-react";

/** Static placeholder until the player engine lands. */
export function PlayerBar() {
  return (
    <footer className="hidden h-[76px] grid-cols-[1fr_minmax(320px,1.4fr)_1fr] items-center gap-4 px-3 md:grid">
      <div className="text-sm text-fg-subtle">Nothing playing</div>
      <div className="flex flex-col items-center gap-1.5 opacity-40">
        <div className="flex items-center gap-5">
          <Shuffle className="size-4" />
          <SkipBack className="size-5" />
          <span className="grid size-9 place-items-center rounded-full bg-fg text-ink-950">
            <Pause className="size-4" />
          </span>
          <SkipForward className="size-5" />
          <Repeat className="size-4" />
        </div>
        <div className="h-1 w-full max-w-[560px] rounded-full bg-ink-700" />
      </div>
      <div />
    </footer>
  );
}
