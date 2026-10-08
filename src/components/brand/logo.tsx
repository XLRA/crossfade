import { cn } from "~/lib/cn";

/**
 * Two equal-power fade curves crossing: one track fading out while the next fades in.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="8" fill="var(--color-accent)" />
      <path
        d="M7 10.5c6.6 0 11.4 11 18 11"
        fill="none"
        stroke="var(--color-accent-ink)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M7 21.5c6.6 0 11.4-11 18-11"
        fill="none"
        stroke="var(--color-accent-ink)"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity=".5"
      />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-7 shrink-0" />
      {!compact && (
        <span className="font-display text-[19px] leading-none tracking-[-0.035em]">crossfade</span>
      )}
    </span>
  );
}

/** The logo's crossing curves as a plain line icon, for the crossfade control. */
export function CrossfadeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 6.5c7 0 11 11 18 11" />
      <path d="M3 17.5c7 0 11-11 18-11" opacity=".55" />
    </svg>
  );
}
