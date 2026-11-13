import { ArrowLeft } from "lucide-react";
import { type Metadata } from "next";
import Link from "next/link";

import { Logo } from "~/components/brand/logo";
import { env } from "~/env";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Crossfade stores about you, why, and who else sees it.",
};

// The contact address is server configuration, so render per request instead of baking in
// whatever the build machine had.
export const dynamic = "force-dynamic";

const UPDATED = "November 13, 2026";

const SECTIONS = {
  stores: "What Crossfade stores",
  accounts: "Your Spotify and Google accounts",
  youtube: "YouTube API Services",
  sharing: "Who else sees it",
  storage: "Cookies and browser storage",
  deleting: "Keeping and deleting data",
  contact: "Contact",
} as const;

type SectionId = keyof typeof SECTIONS;

export default function PrivacyPage() {
  const contact = env.CONTACT_EMAIL;

  return (
    <div className="scroll-area h-dvh">
      <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-6 py-6 sm:px-10">
        <Link href="/" aria-label="Crossfade home">
          <Logo />
        </Link>
        <Link href="/" className="text-fg-muted hover:text-fg inline-flex items-center gap-2 text-sm transition-colors">
          <ArrowLeft className="size-4" />
          Back to listening
        </Link>
      </header>

      <div className="mx-auto grid w-full max-w-[1120px] gap-12 px-6 pt-6 pb-24 sm:px-10 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-16 lg:pt-12">
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-10">
            <p className="eyebrow">On this page</p>
            <ol className="mt-4 space-y-3 text-sm">
              {Object.entries(SECTIONS).map(([id, title]) => (
                <li key={id}>
                  <a href={`#${id}`} className="text-fg-muted hover:text-fg transition-colors">
                    {title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <main className="max-w-[680px]">
          <p className="eyebrow">Privacy policy</p>
          <h1 className="font-display mt-3 text-[clamp(38px,5vw,56px)] leading-[0.98]">Your data in Crossfade</h1>
          <p className="text-fg-muted mt-6 text-lg leading-relaxed">
            Crossfade is a music player that searches, plays and organizes Spotify and YouTube in one place. It&apos;s a
            student project, built for CSC 5750 (Principles of Web Technology) by Mohamed Aloudi, Venkat Yenduri, Armaan
            Bhandal and Tyler Warwick. This page covers what it stores about you, why, and who else sees it.
          </p>
          <p className="text-fg-subtle mt-4 text-sm">Last updated {UPDATED}</p>

          <div className="bg-ink-900 mt-10 rounded-[var(--radius-panel)] border border-white/[0.06] px-6 py-5">
            <h2 className="font-semibold">The short version</h2>
            <List>
              <li>
                Crossfade keeps your profile, the sign-in tokens Spotify or Google give it, and what you do in the app:
                playlists, likes and what you play.
              </li>
              <li>
                It never posts to your Spotify or YouTube account, and reads your playlists only when you import them.
              </li>
              <li>
                No ads, no analytics and no tracking cookies. Your data isn&apos;t sold or shared beyond what&apos;s
                below.
              </li>
            </List>
          </div>

          <Section id="stores">
            <List>
              <li>
                <Strong>Your profile.</Strong> Your name, email address and profile picture, from Spotify or Google when
                you sign in, and a username Crossfade picks for you. You can change your name and username in Settings.
              </li>
              <li>
                <Strong>Sign-in tokens.</Strong> The access and refresh tokens Spotify and Google issue, so Crossfade
                can act for you in the ways listed under the next heading. They&apos;re kept on the Crossfade server and
                never shown to other people.
              </li>
              <li>
                <Strong>What you make.</Strong> Your playlists: their titles, descriptions, any cover image you upload,
                the tracks in them and who added each one. Also who you&apos;ve shared them with, and your Liked Songs.
              </li>
              <li>
                <Strong>What you play.</Strong> A record of each track you listen to for 30 seconds (or half of a
                shorter one) and where you played it from. It fills Recently played and Jump back in on the home page.
              </li>
            </List>
            <P>
              Searches are sent from the Crossfade server to Spotify and YouTube. Results are cached for up to a day so
              repeat searches don&apos;t use up the YouTube quota. The cache keeps the search text, but not who
              searched.
            </P>
          </Section>

          <Section id="accounts">
            <P>
              <Strong>Spotify.</Strong> Signing in with Spotify lets Crossfade read your profile and email, read your
              playlists when you import one, and play full tracks in the browser through Spotify&apos;s Web Playback SDK
              (Spotify requires Premium for that).
            </P>
            <P>
              <Strong>Google.</Strong> Signing in with Google shares only your basic profile: name, email address and
              picture. If you import from YouTube, Crossfade asks separately for read-only access to your YouTube
              account, and uses it only to list your playlists and liked videos for the import.
            </P>
            <P>Crossfade never posts, follows, likes or changes anything on Spotify or YouTube.</P>
            <P>
              Crossfade&apos;s use and transfer of information received from Google APIs adheres to the{" "}
              <A href="https://developers.google.com/terms/api-services-user-data-policy">
                Google API Services User Data Policy
              </A>
              , including the Limited Use requirements.
            </P>
          </Section>

          <Section id="youtube">
            <P>
              Crossfade uses YouTube API Services for search, video details, the embedded player and, if you allow it,
              importing your playlists. By using Crossfade&apos;s YouTube features you agree to the{" "}
              <A href="https://www.youtube.com/t/terms">YouTube Terms of Service</A>, and{" "}
              <A href="https://policies.google.com/privacy">Google&apos;s Privacy Policy</A> covers what Google does
              with the data involved.
            </P>
            <P>
              You can revoke Crossfade&apos;s access to your Google account at any time from{" "}
              <A href="https://security.google.com/settings/security/permissions">Google&apos;s security settings</A>.
              For Spotify, remove it under <A href="https://www.spotify.com/account/apps/">Manage apps</A> on your
              Spotify account page.
            </P>
          </Section>

          <Section id="sharing">
            <List>
              <li>
                <Strong>Other Crossfade users.</Strong> Public playlists can be opened by anyone with the link and
                appear on your profile, with your name, username and picture. Collaborators see the playlists you share
                with them, including who added each track. Private playlists are visible only to you and your
                collaborators.
              </li>
              <li>
                <Strong>Spotify and YouTube.</Strong> Music plays in Spotify&apos;s and YouTube&apos;s own players,
                loaded straight into your browser, so those services see what you play under their own privacy policies.
                YouTube&apos;s player can set its own cookies.
              </li>
              <li>
                <Strong>Hosting.</Strong> Crossfade runs on a server the team operates. Requests reach it through
                Vercel, which serves sleeep.dev, and Cloudflare. Both handle IP addresses and request details to deliver
                pages.
              </li>
            </List>
            <P>Nothing is sold or shared with anyone else, and Crossfade doesn&apos;t show ads.</P>
          </Section>

          <Section id="storage">
            <P>
              Crossfade&apos;s own cookies are only for signing in. One keeps you signed in for up to 30 days, and a few
              short-lived ones protect the sign-in flow. There are no analytics or advertising cookies.
            </P>
            <P>
              Your browser also keeps your player settings, your last queue and your last 10 searches, so they survive a
              reload. They stay on your device, and clearing this site&apos;s data removes them.
            </P>
            <P>
              To stop scripts from draining the YouTube quota, the server counts recent requests per account (per IP
              address for guests) in memory for up to an hour. Those counts are never saved.
            </P>
          </Section>

          <Section id="deleting">
            <P>
              Your data stays until you delete it. You can delete playlists and unlike tracks at any time, and
              disconnecting Spotify or Google in Settings deletes the tokens Crossfade holds for that service.
            </P>
            <P>
              To delete your account, get in touch (below). That removes your profile, your sign-in tokens, the
              playlists you own, your likes and your listening history. Tracks you added to other people&apos;s
              playlists stay in them, without your name.
            </P>
          </Section>

          <Section id="contact">
            <P>
              Questions about your data, or want your account deleted?{" "}
              {contact ? (
                <>
                  Email <A href={`mailto:${contact}`}>{contact}</A>.
                </>
              ) : (
                <>Ask the Crossfade team.</>
              )}
            </P>
            <P>If this page changes, the date at the top changes with it.</P>
          </Section>
        </main>
      </div>
    </div>
  );
}

function Section({ id, children }: { id: SectionId; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className="scroll-mt-8 text-[22px] font-bold tracking-tight">
        {SECTIONS[id]}
      </h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-fg-muted mt-4 text-[15px] leading-relaxed">{children}</p>;
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <ul className="text-fg-muted marker:text-fg-subtle mt-4 list-disc space-y-3 pl-5 text-[15px] leading-relaxed">
      {children}
    </ul>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="text-fg font-semibold">{children}</strong>;
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      className="text-fg decoration-fg-subtle hover:decoration-fg underline underline-offset-[3px] transition-colors"
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {children}
    </a>
  );
}
