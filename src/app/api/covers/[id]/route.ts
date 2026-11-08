import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { roleFor } from "~/server/playlists";

/**
 * Uploaded playlist covers. A public playlist's cover can be cached anywhere; a private one only
 * by the browser of someone allowed to see the playlist. The URL changes with every upload, so
 * either way the image can be cached for good.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{8,40}$/i.test(id)) return notFound();

  const playlist = await db.playlist.findUnique({
    where: { id },
    select: { visibility: true, image: { select: { data: true } } },
  });
  if (!playlist?.image) return notFound();

  const isPublic = playlist.visibility === "PUBLIC";
  if (!isPublic) {
    const session = await auth();
    if (!(await roleFor(id, session?.user.id))) return notFound();
  }

  const body = new Uint8Array(playlist.image.data);
  return new Response(body, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(body.byteLength),
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=31536000, immutable`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}
