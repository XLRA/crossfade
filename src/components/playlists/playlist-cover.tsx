import { Music2 } from "lucide-react";

import { Artwork } from "~/components/tracks/artwork";
import { cn } from "~/lib/cn";

/**
 * A playlist's cover: the custom image if there is one, else a 2x2 mosaic of its first four
 * distinct artworks, else the first artwork, else a placeholder.
 */
export function PlaylistCover({
  covers,
  customUrl,
  className,
  eager,
}: {
  covers: string[];
  customUrl?: string | null;
  className?: string;
  eager?: boolean;
}) {
  if (customUrl) return <Artwork src={customUrl} eager={eager} className={className} />;

  if (covers.length >= 4) {
    return (
      <div className={cn("grid shrink-0 grid-cols-2 grid-rows-2 overflow-hidden bg-ink-750", className)}>
        {covers.slice(0, 4).map((src) => (
          <Artwork key={src} src={src} eager={eager} className="size-full" />
        ))}
      </div>
    );
  }

  if (covers[0]) return <Artwork src={covers[0]} eager={eager} className={className} />;

  return (
    <div className={cn("grid shrink-0 place-items-center bg-ink-750 text-fg-subtle", className)}>
      <Music2 className="size-[38%] max-h-20 max-w-20" aria-hidden />
    </div>
  );
}
