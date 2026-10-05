"use client";

import { Music2 } from "lucide-react";
import { useState } from "react";

import { cn } from "~/lib/cn";

/**
 * Cover art or video thumbnail, cropped square. Falls back to a neutral tile if the image is
 * missing or fails to load (deleted videos, expired CDN URLs).
 */
export function Artwork({
  src,
  alt = "",
  className,
  iconClassName,
  eager = false,
}: {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  iconClassName?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const broken = !src || failed === src;

  return (
    <div className={cn("relative shrink-0 overflow-hidden bg-ink-750", className)}>
      {broken ? (
        <div className="absolute inset-0 grid place-items-center text-fg-subtle">
          <Music2 className={cn("size-[40%] max-h-12 max-w-12", iconClassName)} aria-hidden />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => setFailed(src)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </div>
  );
}
