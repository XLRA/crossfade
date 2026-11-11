/** 3:07, or 1:02:44 for anything an hour or longer. Unknown durations render as a dash. */
export function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0 || !Number.isFinite(ms)) return "–:––";
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Playlist totals: "1 hr 32 min", "47 min", and seconds only while it's short: "4 min 10 sec". */
export function formatLongDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} hr ${m} min`;
  if (m > 0) return s > 0 && m < 10 ? `${m} min ${s} sec` : `${m} min`;
  return `${s} sec`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** "2 hours ago" for the last week, then a plain date. */
export function formatAddedAt(date: Date | string, now = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(seconds / 86400), "day");
  return dateFmt.format(d);
}
