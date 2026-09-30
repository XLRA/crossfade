import "server-only";

import { cache } from "react";

import { type Viewer } from "~/lib/types";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

/** The signed-in user for this request, read fresh from the database (or null for guests). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, username: true, email: true, image: true },
  });
});
