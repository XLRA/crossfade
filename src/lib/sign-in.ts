"use client";

import { usePathname } from "next/navigation";

import { withBase } from "~/lib/base-path";

/** Link to the sign-in page that comes back to `path` afterwards. */
export function signInHref(path: string): string {
  return `/signin?callbackUrl=${encodeURIComponent(withBase(path))}`;
}

/** Sign-in link that returns to the current page. */
export function useSignInHref(): string {
  return signInHref(usePathname());
}
