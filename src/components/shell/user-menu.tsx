"use client";

import { Import, LogOut, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { signOutAction } from "~/app/signin/actions";
import { Avatar } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "~/components/ui/menu";
import { withBase } from "~/lib/base-path";
import { type Viewer } from "~/lib/types";

export function UserMenu({ viewer }: { viewer: Viewer }) {
  return (
    <Menu>
      <MenuTrigger
        aria-label="Account"
        className="bg-ink-850 hover:bg-ink-750 data-[state=open]:bg-ink-750 grid size-12 place-items-center rounded-full transition-[transform,background-color] hover:scale-[1.04]"
      >
        <Avatar src={viewer.image} name={viewer.name ?? viewer.username} seed={viewer.id} size={32} />
      </MenuTrigger>
      <MenuContent align="end" className="w-64">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <Avatar src={viewer.image} name={viewer.name ?? viewer.username} seed={viewer.id} size={40} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{viewer.name ?? viewer.username}</p>
            {viewer.username && <p className="text-fg-muted truncate text-xs">@{viewer.username}</p>}
          </div>
        </div>
        <MenuSeparator />
        {viewer.username && (
          <MenuItem asChild>
            <Link href={`/user/${viewer.username}`}>
              <UserRound />
              Profile
            </Link>
          </MenuItem>
        )}
        <MenuItem asChild>
          <Link href="/import">
            <Import />
            Import playlists
          </Link>
        </MenuItem>
        <MenuItem asChild>
          <Link href="/settings">
            <Settings />
            Settings
          </Link>
        </MenuItem>
        <MenuSeparator />
        <form action={signOutAction}>
          <MenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut />
              Sign out
            </button>
          </MenuItem>
        </form>
      </MenuContent>
    </Menu>
  );
}

function SignInLink() {
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.toString();
  const here = withBase(`${pathname}${query ? `?${query}` : ""}`);
  return (
    <Button asChild variant="light" size="lg" className="h-11 px-6">
      <Link href={`/signin?callbackUrl=${encodeURIComponent(here)}`}>Sign in</Link>
    </Button>
  );
}

export function SignInButton() {
  return (
    <Suspense
      fallback={
        <Button asChild variant="light" size="lg" className="h-11 px-6">
          <Link href="/signin">Sign in</Link>
        </Button>
      }
    >
      <SignInLink />
    </Suspense>
  );
}
