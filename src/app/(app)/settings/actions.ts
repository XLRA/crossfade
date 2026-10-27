"use server";

import { BASE_PATH } from "~/lib/base-path";
import { signIn } from "~/server/auth";
import { GOOGLE_SIGNIN_SCOPES, YOUTUBE_READONLY_SCOPE } from "~/server/auth/scopes";

/** Only return into Crossfade, never to another site. */
function returnPath(value: FormDataEntryValue | null): string {
  const path = typeof value === "string" ? value : "";
  if ((path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) && !path.includes("//")) return path;
  return `${BASE_PATH}/settings`;
}

/**
 * Links Spotify or Google to the signed-in account. Auth.js sees the existing session during the
 * OAuth callback and attaches the new account to it instead of creating a user.
 */
export async function connectAccount(formData: FormData) {
  const provider = formData.get("provider");
  if (provider !== "spotify" && provider !== "google") return;
  await signIn(provider, { redirectTo: returnPath(formData.get("returnTo")) });
}

/**
 * Asks Google for read access to the user's YouTube library on top of what sign in granted
 * (incremental authorization). Offline access gets a refresh token, so imports keep working
 * after the first hour.
 */
export async function grantYouTubeAccess(formData: FormData) {
  await signIn(
    "google",
    { redirectTo: returnPath(formData.get("returnTo")) },
    {
      scope: [...GOOGLE_SIGNIN_SCOPES, YOUTUBE_READONLY_SCOPE].join(" "),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    },
  );
}
