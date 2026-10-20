import { Pause, Play } from "lucide-react";

import { cn } from "~/lib/cn";

/** The big accent play/pause button on playlist, album and profile headers. */
export function PlayButton({
  playing,
  onClick,
  size = "lg",
  disabled,
  label,
}: {
  playing: boolean;
  onClick: () => void;
  size?: "sm" | "lg";
  disabled?: boolean;
  /** What's being played, for screen readers: "Play Road trip". */
  label?: string;
}) {
  const action = playing ? "Pause" : "Play";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label ? `${action} ${label}` : action}
      className={cn(
        "bg-accent text-accent-ink hover:bg-accent-hover grid shrink-0 place-items-center rounded-full shadow-[0_8px_20px_rgb(0_0_0/0.3)] transition-[transform,background-color] hover:scale-[1.04] active:scale-95 disabled:opacity-50 disabled:hover:scale-100",
        size === "lg" ? "size-14" : "size-11",
      )}
    >
      {playing ? (
        <Pause className={cn("fill-current", size === "lg" ? "size-6" : "size-5")} />
      ) : (
        <Play className={cn("ml-0.5 fill-current", size === "lg" ? "size-6" : "size-5")} />
      )}
    </button>
  );
}
