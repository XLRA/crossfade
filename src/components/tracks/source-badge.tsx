import { SpotifyIcon, YouTubeIcon } from "~/components/brand/platform-icons";
import { cn } from "~/lib/cn";
import { type SourceName } from "~/lib/types";

export const SOURCE_LABEL: Record<SourceName, string> = { SPOTIFY: "Spotify", YOUTUBE: "YouTube" };

/** The platform a track plays from, always in that platform's own colors. */
export function SourceIcon({ source, className }: { source: SourceName; className?: string }) {
  return source === "SPOTIFY" ? (
    <SpotifyIcon className={cn("text-spotify", className)} title="Spotify" />
  ) : (
    <YouTubeIcon className={cn("text-youtube", className)} title="YouTube" />
  );
}

export function SourceBadge({
  source,
  className,
  withLabel = true,
}: {
  source: SourceName;
  className?: string;
  withLabel?: boolean;
}) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5", className)}>
      <SourceIcon source={source} className="size-3.5" />
      {withLabel && <span>{SOURCE_LABEL[source]}</span>}
    </span>
  );
}

export function ExplicitBadge() {
  return (
    <span
      title="Explicit"
      aria-label="Explicit"
      className="inline-grid h-4 w-4 shrink-0 place-items-center rounded-[3px] bg-fg-muted/80 text-[9.5px] leading-none font-bold text-ink-950"
    >
      E
    </span>
  );
}
