import { type PrismaClient } from "../../../generated/prisma";

export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_.]{1,22}[a-z0-9])$/;

/** Paths and words that would be confusing as a profile URL or invite target. */
const RESERVED = new Set([
  "admin",
  "api",
  "crossfade",
  "help",
  "import",
  "library",
  "me",
  "playlist",
  "search",
  "settings",
  "signin",
  "signout",
  "spotify",
  "support",
  "system",
  "youtube",
]);

export function isReservedUsername(name: string): boolean {
  return RESERVED.has(name);
}

/** Turns a display name or email into a handle candidate: "Venkat Y." -> "venkaty". */
export function handleFrom(input: string | null | undefined): string {
  const local = (input ?? "").split("@")[0] ?? "";
  const handle = local
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18);
  return handle.length >= 3 && !isReservedUsername(handle) ? handle : "listener";
}

/** Finds a free username starting from the user's name, adding digits until one is free. */
export async function generateUsername(db: PrismaClient, seeds: Array<string | null | undefined>): Promise<string> {
  const base = handleFrom(seeds.find((s) => s && handleFrom(s) !== "listener") ?? null);
  const candidates = [base];
  for (let i = 0; i < 6; i++) {
    candidates.push(`${base}${Math.floor(10 + Math.random() * (i < 3 ? 90 : 9990))}`);
  }
  for (const candidate of candidates) {
    const taken = await db.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}${Date.now().toString(36)}`;
}
