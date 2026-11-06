"use client";

import { Maximize2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { create } from "zustand";

import { SourceIcon } from "~/components/tracks/source-badge";
import { IconButton } from "~/components/ui/button";
import { cn } from "~/lib/cn";
import { PlayerController } from "~/lib/player/controller";
import { usePlayer } from "~/lib/player/store";
import { type SurfaceLayer } from "~/lib/player/types";
import { DESKTOP_QUERY, useMediaQuery } from "~/lib/use-media-query";

/*
 * The platform players are iframes, and moving an iframe in the DOM reloads it (and stops the
 * music). So they live in one fixed layer that's never re-parented, and whichever "slot" is on
 * screen (the now playing panel, the mini dock, the mobile sheet) just marks where that layer
 * should sit. The highest-priority mounted slot wins.
 *
 * YouTube requires the player to stay visible and at least 200x200 while it plays, which is why
 * there's always a slot for it: the dock (or the mini player on phones) appears whenever nothing
 * larger is showing the video.
 */

type Slot = { id: string; element: HTMLElement; priority: number; zIndex: number };

/** Above the page and the desktop dock. Slots inside overlays pass their own. */
const DEFAULT_Z = 31;

const useSlots = create<{ slots: Slot[] }>(() => ({ slots: [] }));

function topSlot(slots: Slot[]): Slot | null {
  let best: Slot | null = null;
  for (const slot of slots) if (!best || slot.priority > best.priority) best = slot;
  return best;
}

/**
 * Marks where the video goes. Give it a size; the surface fills it. A slot inside an overlay
 * passes a `zIndex` just above the overlay's so the video isn't drawn underneath it.
 */
export function MediaSlot({
  id,
  priority,
  zIndex = DEFAULT_Z,
  className,
}: {
  id: string;
  priority: number;
  zIndex?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    useSlots.setState((s) => ({ slots: [...s.slots.filter((x) => x.id !== id), { id, element, priority, zIndex }] }));
    return () => useSlots.setState((s) => ({ slots: s.slots.filter((x) => x.id !== id) }));
  }, [id, priority, zIndex]);
  return <div ref={ref} className={cn("bg-black", className)} aria-hidden />;
}

export const DOCK_PRIORITY = 1;

export function MediaSurface() {
  const frame = useRef<HTMLDivElement>(null);
  const ytA = useRef<HTMLDivElement>(null);
  const ytB = useRef<HTMLDivElement>(null);
  const embed = useRef<HTMLDivElement>(null);
  const surface = usePlayer((s) => s.surface);
  const slot = useSlots((s) => topSlot(s.slots));

  useEffect(() => {
    const controller = new PlayerController({ ytA: ytA.current!, ytB: ytB.current!, embed: embed.current! });
    return () => controller.destroy();
  }, []);

  // Follow the slot every frame while visible. Slots move when panels open, the window resizes
  // or a sheet animates in; reading one rect per frame is cheap and catches all of it.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    if (!slot || !surface) {
      el.style.visibility = "hidden";
      el.style.width = "0px";
      el.style.height = "0px";
      return;
    }
    el.style.borderRadius = getComputedStyle(slot.element).borderRadius;
    el.style.zIndex = String(slot.zIndex);
    let raf = 0;
    let last = "";
    const place = () => {
      const r = slot.element.getBoundingClientRect();
      const key = `${r.left}|${r.top}|${r.width}|${r.height}`;
      if (key !== last) {
        last = key;
        el.style.transform = `translate(${r.left}px, ${r.top}px)`;
        el.style.width = `${r.width}px`;
        el.style.height = `${r.height}px`;
        el.style.visibility = "visible";
      }
      raf = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(raf);
  }, [slot, surface]);

  const layer = (id: SurfaceLayer) =>
    cn(
      "absolute inset-0 transition-opacity duration-700 [&>iframe]:size-full",
      surface === id ? "z-10 opacity-100" : "pointer-events-none opacity-0",
    );

  return (
    <div
      ref={frame}
      className="pointer-events-auto fixed top-0 left-0 overflow-hidden bg-black"
      style={{ visibility: "hidden", width: 0, height: 0, zIndex: DEFAULT_Z }}
    >
      <div ref={ytA} className={layer("yt-a")} />
      <div ref={ytB} className={layer("yt-b")} />
      <div ref={embed} className={layer("embed")} />
    </div>
  );
}

/**
 * Floating player in the corner, shown while a video plays and no bigger view is open. It's
 * also the way into the full now playing view.
 */
export function VideoDock() {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const surface = usePlayer((s) => s.surface);
  const track = usePlayer((s) => s.current?.track);
  const setPanel = usePlayer((s) => s.setPanel);
  const covered = useSlots((s) => s.slots.some((slot) => slot.priority > DOCK_PRIORITY));

  // Phones show the video in the mini player instead.
  if (!desktop || !surface || covered || !track) return null;

  return (
    <div className="bg-ink-800 animate-fade-up fixed right-4 bottom-[92px] z-30 w-[356px] overflow-hidden rounded-xl shadow-[var(--shadow-pop)]">
      <div className="flex h-10 items-center gap-2 pr-1 pl-3">
        <SourceIcon source={track.source} className="size-3.5 shrink-0" />
        <p className="text-fg-muted min-w-0 flex-1 truncate text-[13px]">
          <span className="text-fg">{track.title}</span> · {track.artist}
        </p>
        <IconButton label="Open now playing view" size="sm" onClick={() => setPanel("nowPlaying")}>
          <Maximize2 className="size-4" />
        </IconButton>
      </div>
      <MediaSlot id="dock" priority={DOCK_PRIORITY} className="h-[200px] w-full" />
    </div>
  );
}
