"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { BASE_PATH } from "~/lib/base-path";
import { signIn, signOut } from "~/server/auth";

/** Only allow redirects back into Crossfade. */
function safeRedirect(target: FormDataEntryValue | null): string {
  const value = typeof target === "string" ? target : "";
  if ((value === BASE_PATH || value.startsWith(`${BASE_PATH}/`)) && !value.includes("//")) {
    return value;
  }
  return BASE_PATH;
}

export async function signInWithProvider(formData: FormData) {
  const provider = formData.get("provider");
  if (provider !== "spotify" && provider !== "google") {
    redirect("/signin?error=Configuration");
  }
  await signIn(provider, { redirectTo: safeRedirect(formData.get("callbackUrl")) });
}

export async function signInAsDeveloper(formData: FormData) {
  try {
    await signIn("dev-login", {
      username: formData.get("username"),
      redirectTo: safeRedirect(formData.get("callbackUrl")),
    });
  } catch (error) {
    // signIn() throws a redirect on success; only Auth.js errors are failures.
    if (error instanceof AuthError) {
      redirect(`/signin?error=${error.type}`);
    }
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: BASE_PATH });
}
