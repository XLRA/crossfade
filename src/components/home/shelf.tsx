"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "~/lib/cn";

/**
 * A titled row of cards that scrolls sideways: swipe on touch screens, arrow buttons on hover
 * with a mouse. Children are the cards; each one sets its own width.
 */
export function Shelf({
  title,
  subtitle,
  href,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const page = (direction: 1 | -1) => {
    const el = scroller.current;
    el?.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className={cn("group/shelf mt-9", className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="text-fg-muted mt-0.5 text-sm">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="text-fg-muted hover:text-fg shrink-0 text-sm font-semibold hover:underline">
            Show all
          </Link>
        )}
      </div>
      <div className="relative mt-1.5">
        <div
          ref={scroller}
          onScroll={measure}
          className="no-scrollbar -mx-3 flex snap-x snap-mandatory scroll-px-3 overflow-x-auto overscroll-x-contain px-0"
        >
          {children}
        </div>
        <ArrowButton side="left" hidden={edges.start} onClick={() => page(-1)} />
        <ArrowButton side="right" hidden={edges.end} onClick={() => page(1)} />
      </div>
    </section>
  );
}

function ArrowButton({ side, hidden, onClick }: { side: "left" | "right"; hidden: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={-1}
      aria-hidden
      className={cn(
        "bg-ink-750/95 text-fg hover:bg-ink-700 absolute top-[38%] z-20 hidden size-9 -translate-y-1/2 place-items-center rounded-full shadow-[var(--shadow-pop)] transition-opacity duration-200 md:grid",
        side === "left" ? "-left-2" : "-right-2",
        hidden ? "pointer-events-none opacity-0" : "opacity-0 group-hover/shelf:opacity-100",
      )}
    >
      {side === "left" ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
    </button>
  );
}

/** Width of a card in a shelf: about five across on a wide screen, two and a bit on a phone. */
export const SHELF_ITEM = "w-[clamp(150px,19cqi,204px)] shrink-0 snap-start";
export const SHELF_WIDE_ITEM = "w-[clamp(232px,27cqi,320px)] shrink-0 snap-start";
