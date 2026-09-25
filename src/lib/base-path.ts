/**
 * The app is mounted at /crossfade (see next.config.js). Next.js adds the base path to <Link>,
 * router navigation and redirect() for us, but not to fetch() calls, plain anchors, or URLs we
 * hand to third parties (OAuth redirects, share links), so those go through withBase().
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "/crossfade";

export function withBase(path: string): string {
  if (!path.startsWith("/")) path = `/${path}`;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return path === "/" ? BASE_PATH : `${BASE_PATH}${path}`;
}

/** Absolute URL for things people copy and paste, like share links. */
export function absoluteUrl(path: string): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000");
  return `${origin}${withBase(path)}`;
}
