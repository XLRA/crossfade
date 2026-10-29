"use client";

import { ExternalLink, Import } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";

import { ConnectButton, GrantYouTubeButton } from "~/components/auth/connect-buttons";
import { GoogleIcon, SpotifyIcon, YouTubeIcon } from "~/components/brand/platform-icons";
import { Avatar } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/dialog";
import { Slider } from "~/components/ui/slider";
import { Tooltip } from "~/components/ui/tooltip";
import { cn } from "~/lib/cn";
import { usePlayer } from "~/lib/player/store";
import { type Viewer } from "~/lib/types";
import { api } from "~/trpc/react";

type Provider = "spotify" | "google";
const NAMES: Record<Provider, string> = { spotify: "Spotify", google: "Google" };

export function SettingsView({ viewer, available }: { viewer: Viewer; available: Record<Provider, boolean> }) {
  return (
    <div className="mx-auto w-full max-w-[720px] px-4 pt-8 pb-16 md:px-6">
      <h1 className="font-display text-[clamp(34px,4vw,48px)] leading-none">Settings</h1>
      <Profile viewer={viewer} />
      <Connections viewer={viewer} available={available} />
      <Playback />
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold">{title}</h2>
      {description && <p className="text-fg-muted mt-1 text-sm">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// --- Profile ---------------------------------------------------------------------------------------

function Profile({ viewer }: { viewer: Viewer }) {
  const router = useRouter();
  const [name, setName] = useState(viewer.name ?? "");
  const [username, setUsername] = useState(viewer.username ?? "");
  const update = api.account.updateProfile.useMutation({
    onSuccess: () => {
      toast("Profile saved");
      router.refresh();
    },
    onError: (error) => {
      const fields = error.data?.zodError?.fieldErrors;
      toast.error(fields?.username?.[0] ?? fields?.name?.[0] ?? error.message);
    },
  });
  const dirty = name.trim() !== (viewer.name ?? "") || username.trim().toLowerCase() !== (viewer.username ?? "");

  return (
    <Section title="Profile" description="How you show up to people you share playlists with.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({ name, username });
        }}
        className="bg-ink-850 flex flex-col gap-6 rounded-xl p-5 sm:flex-row sm:items-start"
      >
        <Avatar src={viewer.image} name={name || viewer.username} seed={viewer.id} size={88} className="shrink-0" />
        <div className="grid min-w-0 flex-1 gap-4">
          <Field label="Name">
            {(id) => (
              <input
                id={id}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                autoComplete="name"
                className={inputClass}
              />
            )}
          </Field>
          <Field label="Username" hint="Friends add you to playlists by this.">
            {(id) => (
              <div className="relative">
                <span className="text-fg-subtle pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">@</span>
                <input
                  id={id}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  maxLength={24}
                  autoComplete="username"
                  spellCheck={false}
                  className={cn(inputClass, "pl-7")}
                />
              </div>
            )}
          </Field>
          <div className="flex justify-end">
            <Button type="submit" variant="light" size="sm" disabled={!dirty || update.isPending}>
              Save profile
            </Button>
          </div>
        </div>
      </form>
    </Section>
  );
}

const inputClass =
  "h-10 w-full rounded-md bg-ink-750 px-3 text-sm outline-none ring-1 ring-transparent transition-shadow placeholder:text-fg-subtle focus:ring-white/40";

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-fg-subtle mt-1.5 text-xs">{hint}</p>}
    </div>
  );
}

// --- Connections -----------------------------------------------------------------------------------

function Connections({ viewer, available }: { viewer: Viewer; available: Record<Provider, boolean> }) {
  const router = useRouter();
  const c = viewer.connections;
  const [confirm, setConfirm] = useState<Provider | null>(null);
  const disconnect = api.account.disconnect.useMutation({
    onSuccess: (_result, { provider }) => {
      toast(`${NAMES[provider]} disconnected`);
      setConfirm(null);
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message);
      setConfirm(null);
    },
  });
  const devAccount = viewer.email?.endsWith("@dev.crossfade.local") ?? false;
  const canDisconnect = c.loginMethods > 1 || devAccount;

  const disconnectButton = (provider: Provider) => (
    <Tooltip
      label={canDisconnect ? `Unlink ${NAMES[provider]}` : "It's how you sign in, so connect the other one first"}
    >
      <span>
        <Button variant="outline" size="sm" disabled={!canDisconnect} onClick={() => setConfirm(provider)}>
          Disconnect
        </Button>
      </span>
    </Tooltip>
  );

  return (
    <Section
      title="Connected accounts"
      description="Searching and listening work without either. Your libraries, and full Spotify tracks, need them."
    >
      <div className="bg-ink-850 divide-y divide-white/[0.06] overflow-hidden rounded-xl">
        <ConnectionRow
          icon={<SpotifyIcon className="text-spotify size-6" />}
          name="Spotify"
          status={
            !available.spotify
              ? "Not set up on this server."
              : !c.spotify
                ? "Play full tracks with Premium, and bring in your Spotify playlists."
                : c.spotifyExpired
                  ? "The connection expired. Reconnect to keep playing full tracks."
                  : "Connected. With Premium, full tracks play right here; free accounts get previews."
          }
          action={
            !available.spotify ? null : !c.spotify ? (
              <ConnectButton provider="spotify">Connect</ConnectButton>
            ) : c.spotifyExpired ? (
              <ConnectButton provider="spotify">Reconnect</ConnectButton>
            ) : (
              disconnectButton("spotify")
            )
          }
        />
        <ConnectionRow
          icon={<GoogleIcon className="size-5" />}
          name="Google"
          status={
            !available.google
              ? "Not set up on this server."
              : c.google
                ? "Connected for signing in."
                : "Sign in with Google too, and bring in your YouTube playlists."
          }
          action={
            !available.google ? null : c.google ? (
              disconnectButton("google")
            ) : (
              <ConnectButton provider="google">Connect</ConnectButton>
            )
          }
        />
        {c.google && (
          <ConnectionRow
            icon={<YouTubeIcon className="text-youtube size-6" />}
            name="YouTube library"
            status={
              c.youtube
                ? "Shared, read only. Your playlists and liked videos can be imported."
                : "Not shared. Allow read-only access to import your playlists and liked videos."
            }
            action={
              c.youtube ? (
                <a
                  href="https://myaccount.google.com/connections"
                  target="_blank"
                  rel="noreferrer"
                  className="text-fg-muted hover:text-fg inline-flex items-center gap-1.5 text-[13px] font-semibold"
                >
                  Manage <ExternalLink className="size-3.5" />
                </a>
              ) : (
                <GrantYouTubeButton>Allow access</GrantYouTubeButton>
              )
            }
          />
        )}
      </div>

      {(c.spotify || c.youtube) && (
        <Link
          href="/import"
          className="text-fg-muted hover:text-fg mt-3 inline-flex items-center gap-1.5 text-sm font-semibold"
        >
          <Import className="size-4" aria-hidden />
          Import playlists from {c.spotify && c.youtube ? "Spotify and YouTube" : c.spotify ? "Spotify" : "YouTube"}
        </Link>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Disconnect ${confirm ? NAMES[confirm] : ""}?`}
        description={
          confirm === "spotify"
            ? "Spotify tracks will play as previews, and you won't be able to import from Spotify until you connect it again. Your playlists stay as they are."
            : "You won't be able to sign in with Google or import from YouTube until you connect it again. Your playlists stay as they are."
        }
        confirmLabel="Disconnect"
        pending={disconnect.isPending}
        onConfirm={() => confirm && disconnect.mutate({ provider: confirm })}
      />
    </Section>
  );
}

function ConnectionRow({
  icon,
  name,
  status,
  action,
}: {
  icon: React.ReactNode;
  name: string;
  status: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-black/35">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{name}</p>
        <p className="text-fg-muted text-sm leading-snug">{status}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// --- Playback --------------------------------------------------------------------------------------

function Playback() {
  const seconds = usePlayer((s) => s.crossfadeSeconds);
  const setCrossfade = usePlayer((s) => s.setCrossfade);

  return (
    <Section title="Playback">
      <div className="bg-ink-850 rounded-xl px-5 py-4">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-semibold">Crossfade</p>
          <p className="tabular text-fg-muted text-sm">{seconds > 0 ? `${seconds} s` : "Off"}</p>
        </div>
        <p className="text-fg-muted mt-1 text-sm leading-snug">
          Blends the end of each track into the next. Two Spotify tracks can&apos;t play at once, so between those the
          first fades out and the next fades in.
        </p>
        <Slider
          label="Crossfade length in seconds"
          value={seconds}
          max={12}
          step={1}
          valueText={seconds > 0 ? `${seconds} seconds` : "Off"}
          onChange={setCrossfade}
          className="mt-4"
        />
        <div className="text-fg-subtle mt-1.5 flex justify-between text-[11px]">
          <span>Off</span>
          <span>12 s</span>
        </div>
      </div>
    </Section>
  );
}
