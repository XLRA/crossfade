"use client";

import { LoaderCircle, Terminal } from "lucide-react";
import { useFormStatus } from "react-dom";

import { signInAsDeveloper, signInWithProvider } from "~/app/signin/actions";
import { GoogleIcon, SpotifyIcon } from "~/components/brand/platform-icons";
import { cn } from "~/lib/cn";

const PROVIDERS = {
  // Spotify's guidelines allow its green with a black logo and label.
  spotify: {
    label: "Continue with Spotify",
    className: "bg-spotify text-black hover:brightness-110",
    icon: <SpotifyIcon className="size-[22px]" />,
  },
  // Google's sign-in branding: white button, dark label, full-color G.
  google: {
    label: "Continue with Google",
    className: "bg-white text-[#1f1f1f] hover:bg-[#f2f2f2]",
    icon: <GoogleIcon className="size-5" />,
  },
} as const;

function SubmitButton({ provider }: { provider: keyof typeof PROVIDERS }) {
  const { pending } = useFormStatus();
  const config = PROVIDERS[provider];
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "relative flex h-12 w-full items-center justify-center gap-3 rounded-full text-[15px] font-semibold transition-[filter,background-color,transform] active:scale-[0.99] disabled:opacity-80",
        config.className,
      )}
    >
      <span className="absolute left-5">
        {pending ? <LoaderCircle className="size-5 animate-spin" /> : config.icon}
      </span>
      {config.label}
    </button>
  );
}

export function ProviderButton({ provider, callbackUrl }: { provider: keyof typeof PROVIDERS; callbackUrl: string }) {
  return (
    <form action={signInWithProvider}>
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <SubmitButton provider={provider} />
    </form>
  );
}

function DevSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-ink-700 text-fg hover:bg-ink-600 h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-60"
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : "Enter"}
    </button>
  );
}

/** Only rendered when AUTH_DEV_LOGIN=true outside production. */
export function DevLoginForm({ callbackUrl }: { callbackUrl: string }) {
  return (
    <form action={signInAsDeveloper} className="mt-8 rounded-xl border border-dashed border-white/15 p-4">
      <p className="text-fg-muted flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
        <Terminal className="size-3.5" /> Developer login
      </p>
      <p className="text-fg-subtle mt-1 text-xs">
        Local testing only. Signs in as (or creates) a user with this username.
      </p>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div className="mt-3 flex gap-2">
        <input
          name="username"
          required
          minLength={3}
          maxLength={24}
          pattern="[A-Za-z0-9_]+"
          placeholder="username"
          autoComplete="off"
          className="bg-ink-850 placeholder:text-fg-subtle h-10 min-w-0 flex-1 rounded-full px-4 text-sm outline-none focus:ring-1 focus:ring-white/30"
        />
        <DevSubmit />
      </div>
    </form>
  );
}
