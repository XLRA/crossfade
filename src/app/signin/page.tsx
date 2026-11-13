import { ArrowLeft } from "lucide-react";
import { type Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CrossfadeArt } from "~/components/auth/crossfade-art";
import { DevLoginForm, ProviderButton } from "~/components/auth/sign-in-buttons";
import { Logo } from "~/components/brand/logo";
import { BASE_PATH } from "~/lib/base-path";
import { auth } from "~/server/auth";
import { enabledProviders } from "~/server/auth/config";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email already belongs to a Crossfade account that was created with the other service. Sign in with that one first, then connect this service from Settings.",
  AccessDenied: "Sign in was cancelled before it finished.",
  OAuthCallbackError: "The provider didn't finish signing you in. Give it another try.",
  CredentialsSignin: "Usernames need at least three letters or numbers.",
  Configuration:
    "Sign in failed on our side. If you used Spotify: while the app is in Spotify's development mode, only accounts on its allowlist can sign in. Ask the project owner to add yours, or continue with Google.",
};

type SearchParams = Promise<{ error?: string; callbackUrl?: string }>;

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const { error, callbackUrl: rawCallback } = await searchParams;
  const callbackUrl =
    rawCallback && rawCallback.startsWith(BASE_PATH) && !rawCallback.includes("//") ? rawCallback : BASE_PATH;

  const session = await auth();
  if (session?.user) redirect(callbackUrl.slice(BASE_PATH.length) || "/");

  const message = error ? (ERRORS[error] ?? "Something went wrong signing you in. Try again.") : null;
  const nothingConfigured = !enabledProviders.spotify && !enabledProviders.google && !enabledProviders.dev;

  return (
    <div className="scroll-area h-dvh">
      <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.15fr)_minmax(420px,1fr)] lg:p-2">
        <section className="bg-ink-900 relative hidden flex-col overflow-hidden rounded-[var(--radius-panel)] p-12 lg:flex">
          <Link href="/" aria-label="Crossfade home" className="self-start">
            <Logo />
          </Link>
          <div className="mt-16 max-w-[580px]">
            <h1 className="font-display text-[clamp(44px,4.4vw,68px)] leading-[0.95]">
              Spotify and YouTube, in one queue.
            </h1>
            <p className="text-fg-muted mt-6 max-w-[460px] text-lg leading-relaxed">
              Put the live take from YouTube right after the studio cut on Spotify. Crossfade plays the whole list and
              blends every handoff.
            </p>
          </div>
          <div className="relative -mx-12 my-8 min-h-[160px] flex-1">
            <CrossfadeArt className="absolute inset-0 h-full w-full" />
          </div>
          <dl className="grid max-w-[600px] grid-cols-3 gap-6 border-t border-white/10 pt-6 text-sm">
            {[
              ["Search both", "One search bar, every result labeled with its source."],
              ["Mix playlists", "Tracks and videos side by side, in any order."],
              ["Share them", "Friends can edit, whatever service they use."],
            ].map(([title, body]) => (
              <div key={title}>
                <dt className="text-fg font-semibold">{title}</dt>
                <dd className="text-fg-muted mt-1">{body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="flex flex-col px-6 py-8 sm:px-10 lg:px-16">
          <div className="flex items-center justify-between lg:justify-end">
            <Link href="/" className="lg:hidden" aria-label="Crossfade home">
              <Logo />
            </Link>
            <Link
              href="/"
              className="text-fg-muted hover:text-fg inline-flex items-center gap-2 text-sm transition-colors"
            >
              <ArrowLeft className="size-4" />
              Back to listening
            </Link>
          </div>

          <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-12">
            <h2 className="text-[30px] font-bold tracking-tight">Sign in to Crossfade</h2>
            <p className="text-fg-muted mt-2 text-[15px] leading-relaxed">
              Use whichever account your music lives in. You can connect the other one later.
            </p>

            {message && (
              <p
                role="alert"
                className="border-danger/30 bg-danger/10 text-fg mt-6 rounded-lg border px-4 py-3 text-sm leading-relaxed"
              >
                {message}
              </p>
            )}

            <div className="mt-8 flex flex-col gap-3">
              {enabledProviders.spotify && <ProviderButton provider="spotify" callbackUrl={callbackUrl} />}
              {enabledProviders.google && <ProviderButton provider="google" callbackUrl={callbackUrl} />}
              {nothingConfigured && (
                <p className="bg-ink-850 text-fg-muted rounded-lg px-4 py-3 text-sm">
                  Sign in isn&apos;t configured on this server yet. Set the Spotify or Google credentials described in
                  .env.example.
                </p>
              )}
            </div>

            {enabledProviders.dev && <DevLoginForm callbackUrl={callbackUrl} />}

            <p className="text-fg-subtle mt-8 text-xs leading-relaxed">
              Crossfade reads your name, email and profile picture. Your playlists are only read if you choose to import
              them, and Crossfade never posts to your accounts.{" "}
              <Link href="/privacy" className="hover:text-fg underline underline-offset-2 transition-colors">
                Privacy policy
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
