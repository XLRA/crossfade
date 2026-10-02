import { cn } from "~/lib/cn";

/** Muted tones for people without a profile photo, picked from the id so they stay stable. */
const TONES = ["#5b4a3a", "#3d4f5c", "#4f3d5c", "#3d5c4a", "#5c3d45", "#5c563d", "#3d455c"];

function toneFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return TONES[Math.abs(hash) % TONES.length]!;
}

export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}

export function Avatar({
  src,
  name,
  seed,
  size = 32,
  className,
}: {
  src?: string | null;
  name?: string | null;
  seed?: string;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={style}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold text-fg/90",
        className,
      )}
      style={{ ...style, backgroundColor: toneFor(seed ?? name ?? "?") }}
    >
      {initialsOf(name)}
    </span>
  );
}
