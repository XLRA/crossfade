"use client";

import { ExternalLink, X } from "lucide-react";
import Link from "next/link";

import { MediaSlot } from "~/components/player/media-surface";
import { Artwork } from "~/components/tracks/artwork";
import { SourceBadge, SOURCE_LABEL } from "~/components/tracks/source-badge";
import { TrackRow } from "~/components/tracks/track-row";
import { IconButton } from "~/components/ui/button";
import { formatDuration, plural } from "~/lib/format";
import { peekNext, remainingInContext } from "~/lib/player/queue";
import { usePlayer } from "~/lib/player/store";
import { type QueueItem } from "~/lib/player/types";
import { type TrackData } from "~/lib/types";

export const PANEL_SLOT_PRIORITY = 2;

/** Spotify-style right panel: the now playing view or the queue, toggled from the player bar. */
export function RightPanel() {
  const panel = usePlayer((s) => s.panel);
  const hasTrack = usePlayer((s) => Boolean(s.current));
  if (!panel || (panel === "nowPlaying" && !hasTrack)) return null;

  return (
    <aside
      aria-label={panel === "queue" ? "Queue" : "Now playing"}
      className="hidden w-[320px] shrink-0 flex-col overflow-hidden rounded-[var(--radius-panel)] bg-ink-900 animate-fade-in lg:flex xl:w-[380px]"
    >
      {panel === "queue" ? <QueuePanel /> : <NowPlayingPanel />}
    </aside>
  );
}

function PanelHeader({ title, onClose }: { title: React.ReactNode; onClose: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 pr-2 pl-4">
      <h2 className="min-w-0 truncate text-[15px] font-semibold">{title}</h2>
      <IconButton label="Close" size="sm" onClick={onClose} tooltipSide="left">
        <X className="size-[18px]" />
      </IconButton>
    </header>
  );
}

export function sourceUrl(track: Pick<TrackData, "source" | "sourceId">): string {
  return track.source === "YOUTUBE"
    ? `https://www.youtube.com/watch?v=${track.sourceId}`
    : `https://open.spotify.com/track/${track.sourceId}`;
}

function NowPlayingPanel() {
  const current = usePlayer((s) => s.current);
  const context = usePlayer((s) => s.context);
  const surface = usePlayer((s) => s.surface);
  const duration = usePlayer((s) => s.durationMs);
  const next = usePlayer((s) => peekNext(s, { auto: false }));
  const setPanel = usePlayer((s) => s.setPanel);
  const jumpTo = usePlayer((s) => s.jumpTo);
  if (!current) return null;
  const { track } = current;

  return (
    <>
      <PanelHeader
        title={
          context?.href ? (
            <Link href={context.href} className="hover:underline">
              {context.title}
            </Link>
          ) : (
            (context?.title ?? "Now playing")
          )
        }
        onClose={() => setPanel(null)}
      />
      {/* Kept out of the scrolling area so the video never slides under the header. */}
      {surface ? (
        <MediaSlot id="panel" priority={PANEL_SLOT_PRIORITY} className="h-[200px] w-full shrink-0 xl:aspect-video xl:h-auto" />
      ) : null}
      <div className="scroll-area min-h-0 flex-1 px-4 pb-6">
        {!surface && (
          <Artwork
            src={track.artworkUrl}
            eager
            className="aspect-square w-full rounded-lg shadow-[var(--shadow-art)]"
            iconClassName="max-h-20 max-w-20"
          />
        )}
        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display line-clamp-2 text-[24px] leading-tight">{track.title}</p>
            <p className="mt-1 truncate text-fg-muted">{track.artist}</p>
          </div>
        </div>

        <div className="mt-5 rounded-lg bg-ink-850 p-4">
          <p className="text-[13px] font-semibold">About this track</p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
            <dt className="text-fg-muted">Playing from</dt>
            <dd className="flex items-center gap-1.5">
              <SourceBadge source={track.source} />
            </dd>
            {track.album && (
              <>
                <dt className="text-fg-muted">Album</dt>
                <dd className="truncate">{track.album}</dd>
              </>
            )}
            <dt className="text-fg-muted">Length</dt>
            <dd className="tabular">{formatDuration(duration || track.durationMs)}</dd>
          </dl>
          <a
            href={sourceUrl(track)}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted hover:text-fg"
          >
            Open on {SOURCE_LABEL[track.source]}
            <ExternalLink className="size-3.5" />
          </a>
        </div>

        {next && (
          <div className="mt-3 rounded-lg bg-ink-850 p-2 pt-3">
            <div className="flex items-center justify-between px-2">
              <p className="text-[13px] font-semibold">Next up</p>
              <button
                type="button"
                onClick={() => setPanel("queue")}
                className="text-[13px] font-medium text-fg-muted hover:text-fg hover:underline"
              >
                Open queue
              </button>
            </div>
            <TrackRow track={next.track} onPlay={() => jumpTo(next.uid)} className="mt-1" />
          </div>
        )}
      </div>
    </>
  );
}

function QueuePanel() {
  const current = usePlayer((s) => s.current);
  const upNext = usePlayer((s) => s.upNext);
  const context = usePlayer((s) => s.context);
  const rest = usePlayer((s) => s.order);
  const index = usePlayer((s) => s.index);
  const { setPanel, jumpTo, removeFromQueue, clearQueue } = usePlayer.getState();
  const remaining = remainingInContext({ order: rest, index });
  const shown = remaining.slice(0, 100);

  return (
    <>
      <PanelHeader title="Queue" onClose={() => setPanel(null)} />
      <div className="scroll-area min-h-0 flex-1 px-2 pb-6">
        {!current && upNext.length === 0 ? (
          <div className="px-3 py-16 text-center">
            <p className="font-semibold">Your queue is empty</p>
            <p className="mt-1 text-sm text-fg-muted">
              Play something, or use &ldquo;Add to queue&rdquo; on any track.
            </p>
          </div>
        ) : null}

        {current && (
          <Section title="Now playing">
            <TrackRow track={current.track} />
          </Section>
        )}

        {upNext.length > 0 && (
          <Section
            title="Next in queue"
            action={
              <button
                type="button"
                onClick={clearQueue}
                className="text-[13px] font-medium text-fg-muted hover:text-fg hover:underline"
              >
                Clear queue
              </button>
            }
          >
            {upNext.map((item) => (
              <QueueRow key={item.uid} item={item} onPlay={() => jumpTo(item.uid)} onRemove={() => removeFromQueue(item.uid)} />
            ))}
          </Section>
        )}

        {shown.length > 0 && (
          <Section title={context ? `Next from: ${context.title}` : "Next up"}>
            {shown.map((item) => (
              <QueueRow key={item.uid} item={item} onPlay={() => jumpTo(item.uid)} />
            ))}
            {remaining.length > shown.length && (
              <p className="px-2 pt-2 text-[13px] text-fg-subtle">
                and {plural(remaining.length - shown.length, "more track")}
              </p>
            )}
          </Section>
        )}
      </div>
    </>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-3 first:mt-0">
      <div className="flex h-9 items-center justify-between gap-2 px-2">
        <h3 className="truncate text-[13px] font-semibold text-fg-muted">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function QueueRow({ item, onPlay, onRemove }: { item: QueueItem; onPlay: () => void; onRemove?: () => void }) {
  return (
    <TrackRow
      track={item.track}
      onPlay={onPlay}
      actions={
        onRemove && (
          <IconButton
            label="Remove from queue"
            size="sm"
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <X className="size-4" />
          </IconButton>
        )
      }
    />
  );
}
