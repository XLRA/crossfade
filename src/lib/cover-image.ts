"use client";

/** Covers are stored at this size, which is as big as any screen shows them. */
const COVER_PX = 640;
/** Stay under the server's 512 KB limit with room to spare. */
const MAX_BYTES = 480 * 1024;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MIN_SIDE_PX = 300;

export const COVER_ACCEPT = "image/jpeg,image/png,image/webp";

/** A problem with the picked image, worded for the person who picked it. */
export class CoverImageError extends Error {}

/**
 * Turns a picked file into a cover: the largest centered square, scaled to 640px and saved as a
 * JPEG. Doing it in the browser keeps uploads small, and the server never has to decode images.
 */
export async function prepareCover(file: File): Promise<Blob> {
  if (!COVER_ACCEPT.split(",").includes(file.type)) throw new CoverImageError("Choose a JPEG, PNG or WebP image.");
  if (file.size > MAX_INPUT_BYTES) throw new CoverImageError("That image is over 25 MB. Choose a smaller one.");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new CoverImageError("That image couldn't be opened. Try another one.");
  }

  try {
    const side = Math.min(bitmap.width, bitmap.height);
    if (side < MIN_SIDE_PX) {
      throw new CoverImageError(`That image is too small. Use one at least ${MIN_SIDE_PX} pixels on each side.`);
    }
    const size = Math.min(COVER_PX, side);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new CoverImageError("Your browser couldn't resize that image.");
    // JPEG has no transparency, so transparent PNGs get the app's background instead of black.
    ctx.fillStyle = "#141418";
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);

    for (const quality of [0.86, 0.78, 0.68, 0.56]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MAX_BYTES) return blob;
    }
    throw new CoverImageError("That image is too detailed to shrink enough. Try another one.");
  } finally {
    bitmap.close();
  }
}

/** The blob's bytes as base64, for sending through tRPC. */
export async function toBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Couldn't read the image."));
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the image."));
    reader.readAsDataURL(blob);
  });
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}
