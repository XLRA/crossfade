"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { connectAccount, grantYouTubeAccess } from "~/app/(app)/settings/actions";
import { Button, type ButtonProps } from "~/components/ui/button";
import { BASE_PATH } from "~/lib/base-path";

function Submit({ children, variant = "light" }: { children: React.ReactNode; variant?: ButtonProps["variant"] }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending && <LoaderCircle className="size-3.5 animate-spin" />}
      {children}
    </Button>
  );
}

/** Starts the OAuth flow that links Spotify or Google to the signed-in account. */
export function ConnectButton({
  provider,
  returnTo = `${BASE_PATH}/settings`,
  variant,
  children,
}: {
  provider: "spotify" | "google";
  /** Where to land afterwards, including the base path. */
  returnTo?: string;
  variant?: ButtonProps["variant"];
  children: React.ReactNode;
}) {
  return (
    <form action={connectAccount}>
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Submit variant={variant}>{children}</Submit>
    </form>
  );
}

/** Asks Google for read-only access to the user's YouTube playlists. */
export function GrantYouTubeButton({
  returnTo = `${BASE_PATH}/settings`,
  variant,
  children,
}: {
  returnTo?: string;
  variant?: ButtonProps["variant"];
  children: React.ReactNode;
}) {
  return (
    <form action={grantYouTubeAccess}>
      <input type="hidden" name="returnTo" value={returnTo} />
      <Submit variant={variant}>{children}</Submit>
    </form>
  );
}
