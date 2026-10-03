/**
 * Pure helpers for turning YouTube video metadata into track metadata. Kept free of I/O so they
 * can be unit tested.
 */

/** ISO 8601 duration from contentDetails.duration, e.g. "PT1H2M3S" -> 3723000. Live is "P0D". */
export function parseIsoDuration(iso: string | null | undefined): number {
  if (!iso) return 0;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso);
  if (!match) return 0;
  const [, d, h, m, s] = match;
  const seconds =
    Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
  return Math.round(seconds * 1000);
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** The search endpoint returns HTML-escaped titles ("Don&#39;t Stop"). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) {
      return String.fromCodePoint(parseInt(code.slice(2), 16));
    }
    if (code.startsWith("#")) return String.fromCodePoint(parseInt(code.slice(1), 10));
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

// Bracketed tags that describe the upload rather than the recording. Things like "(Live at
// Wembley)", "(Acoustic)" or "(Remix)" are part of what the track *is*, so they stay.
const NOISE_TAG =
  /\s*[([]\s*(?:official\s+)?(?:(?:hd|hq|4k|music|lyrics?|lyric|audio|visuali[sz]er|video|clip|m\/?v|explicit|clean|remaster(?:ed)?\s*\d{0,4})\s*)+[)\]]/gi;
const OFFICIAL_SUFFIX = /\s*[|•-]\s*official\s+(?:music\s+)?(?:video|audio|visuali[sz]er|lyric\s+video)\s*$/i;
const DASHES = /\s+[-–—]\s+/;

function tidy(text: string): string {
  return text.replace(/\s{2,}/g, " ").replace(/^[\s\-–—|•]+|[\s\-–—|•]+$/g, "").trim();
}

/** "TaylorSwiftVEVO" -> "Taylor Swift", "Daft Punk - Topic" -> "Daft Punk". */
export function cleanChannelName(channel: string): string {
  let name = channel.replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "").replace(/\s+Official$/i, "");
  if (!/\s/.test(name)) name = name.replace(/([a-z])([A-Z])/g, "$1 $2");
  return tidy(name) || channel;
}

/**
 * Splits a video title into song title and artist. Topic channels (auto-generated "Artist -
 * Topic") are reliable, then "Artist - Title" titles, then the channel name.
 */
export function splitVideoTitle(rawTitle: string, channel: string): { title: string; artist: string } {
  const title = tidy(decodeEntities(rawTitle).replace(NOISE_TAG, "").replace(OFFICIAL_SUFFIX, ""));
  const decodedChannel = decodeEntities(channel);

  if (/\s-\sTopic$/i.test(decodedChannel)) {
    return { title: title || rawTitle, artist: cleanChannelName(decodedChannel) };
  }

  const parts = title.split(DASHES);
  if (parts.length >= 2) {
    const artist = tidy(parts[0]!);
    const song = tidy(parts.slice(1).join(" - "));
    if (artist.length > 0 && artist.length <= 80 && song.length > 0) {
      return { title: song.replace(/^["“](.*)["”]$/, "$1"), artist };
    }
  }

  return { title: title || rawTitle, artist: cleanChannelName(decodedChannel) };
}

export function youtubeThumbnail(videoId: string): string {
  // mqdefault is 16:9 with no letterboxing, so it crops cleanly to a square.
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}
