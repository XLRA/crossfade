"use client";

import { useEffect, useState } from "react";

/** Hue in degrees and saturation in percent; each surface picks its own lightness. */
export type Tint = { h: number; s: number };

const cache = new Map<string, Tint | null>();

function hueAndSaturation(r: number, g: number, b: number): Tint {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0 };
  const lightness = (max + min) / 2;
  const s = delta / (1 - Math.abs(2 * lightness - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;
  return { h: Math.round((h * 60 + 360) % 360), s: Math.round(Math.min(s, 0.6) * 100) };
}

/**
 * The color of an image, weighted toward its most colorful pixels so a black background or a
 * white border doesn't wash it out. Throws if the host doesn't allow cross-origin reads.
 */
function sample(img: HTMLImageElement): Tint | null {
  const size = 24;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const pr = data[i] ?? 0;
    const pg = data[i + 1] ?? 0;
    const pb = data[i + 2] ?? 0;
    const max = Math.max(pr, pg, pb);
    const min = Math.min(pr, pg, pb);
    const weight = (max - min) / 255 + (max > 24 && min < 232 ? 0.04 : 0);
    r += pr * weight;
    g += pg * weight;
    b += pb * weight;
    total += weight;
  }
  return total > 0 ? hueAndSaturation(r / total, g / total, b / total) : null;
}

/**
 * The dominant color of a piece of artwork, for tinting what's around it. Undefined while the
 * image is being sampled; null when it can't be (no artwork, or the host blocks it).
 */
export function useArtworkTint(src: string | null | undefined): Tint | null | undefined {
  const [sampled, setSampled] = useState<{ src: string; tint: Tint | null } | null>(null);

  useEffect(() => {
    if (!src || cache.has(src)) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      let tint: Tint | null = null;
      try {
        tint = sample(img);
      } catch {
        tint = null;
      }
      cache.set(src, tint);
      if (!cancelled) setSampled({ src, tint });
    };
    img.onerror = () => {
      cache.set(src, null);
      if (!cancelled) setSampled({ src, tint: null });
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!src) return null;
  if (sampled?.src === src) return sampled.tint;
  return cache.get(src);
}

export const tintColor = (tint: Tint, lightness: number) => `hsl(${tint.h} ${tint.s}% ${lightness}%)`;
