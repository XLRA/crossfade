"use client";

import { House, LibraryBig, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "~/lib/cn";

const TABS = [
  { href: "/", label: "Home", icon: House, match: (path: string) => path === "/" },
  { href: "/search", label: "Search", icon: Search, match: (path: string) => path.startsWith("/search") },
  {
    href: "/library",
    label: "Your library",
    icon: LibraryBig,
    match: (path: string) => path === "/library" || path === "/liked" || path.startsWith("/playlist/"),
  },
];

/** Phone navigation along the bottom edge, under the mini player. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="bg-ink-950 grid shrink-0 grid-cols-3 pb-[env(safe-area-inset-bottom)] md:hidden">
      {TABS.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
              active ? "text-fg" : "text-fg-muted active:text-fg",
            )}
          >
            <Icon className="size-6" strokeWidth={active ? 2.4 : 1.9} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
