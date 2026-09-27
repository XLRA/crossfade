"use client";

import { House, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { Logo } from "~/components/brand/logo";
import { cn } from "~/lib/cn";

export function TopBar({ right }: { right?: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <header className="flex h-16 items-center gap-2 px-2">
      <div className="hidden w-[284px] shrink-0 md:block lg:w-[304px]">
        <Link href="/" className="inline-flex rounded-md px-2 py-1" aria-label="Crossfade home">
          <Logo />
        </Link>
      </div>
      <Link href="/" className="md:hidden" aria-label="Crossfade home">
        <Logo compact />
      </Link>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        <Link
          href="/"
          aria-label="Home"
          className={cn(
            "hidden size-12 shrink-0 place-items-center rounded-full bg-ink-850 transition-colors hover:bg-ink-750 md:grid",
            pathname === "/" ? "text-fg" : "text-fg-muted hover:text-fg",
          )}
        >
          <House className="size-[22px]" strokeWidth={pathname === "/" ? 2.4 : 2} />
        </Link>
        <Suspense fallback={<SearchBoxShell />}>
          <SearchBox />
        </Suspense>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 md:min-w-[200px]">{right}</div>
    </header>
  );
}

function SearchBoxShell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="group relative w-full max-w-[480px]">
      <Search
        className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-fg-muted transition-colors group-focus-within:text-fg"
        aria-hidden
      />
      {children ?? (
        <div className="h-12 w-full rounded-full bg-ink-850" aria-hidden />
      )}
    </div>
  );
}

function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQuery = pathname === "/search" ? (params.get("q") ?? "") : "";
  const [value, setValue] = useState(urlQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);

  // Keep the box in sync when the URL changes underneath us (back/forward, links).
  useEffect(() => {
    setValue(urlQuery);
  }, [urlQuery]);

  // "/" or Ctrl/Cmd+K jumps to search from anywhere that isn't already a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (q: string, mode: "push" | "replace") => {
    const trimmed = q.trim();
    const href = trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search";
    if (mode === "push") router.push(href);
    else router.replace(href, { scroll: false });
  };

  const onChange = (next: string) => {
    setValue(next);
    window.clearTimeout(timer.current);
    // Search as you type, but only once the user pauses; YouTube searches are expensive.
    timer.current = window.setTimeout(() => {
      if (next.trim().length === 0 && pathname !== "/search") return;
      go(next, pathname === "/search" ? "replace" : "push");
    }, 450);
  };

  return (
    <SearchBoxShell>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          window.clearTimeout(timer.current);
          go(value, pathname === "/search" ? "replace" : "push");
        }}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.currentTarget.blur();
            }
          }}
          onFocus={() => {
            if (pathname !== "/search" && value === "") router.prefetch("/search");
          }}
          type="search"
          name="q"
          autoComplete="off"
          spellCheck={false}
          placeholder="Search Spotify and YouTube, or paste a link"
          aria-label="Search Spotify and YouTube"
          className="h-12 w-full rounded-full border border-transparent bg-ink-850 pr-12 pl-12 text-[15px] text-fg placeholder:text-fg-subtle transition-colors outline-none hover:border-white/10 hover:bg-ink-800 focus:border-white/25 focus:bg-ink-800 [&::-webkit-search-cancel-button]:hidden"
        />
      </form>
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
            if (pathname === "/search") go("", "replace");
          }}
          className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-full text-fg-muted hover:text-fg"
        >
          <X className="size-[18px]" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute top-1/2 right-4 hidden -translate-y-1/2 rounded border border-white/10 px-1.5 py-0.5 text-[11px] font-medium text-fg-subtle lg:block">
          /
        </kbd>
      )}
    </SearchBoxShell>
  );
}
