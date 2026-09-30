import { NextResponse, type NextRequest } from "next/server";

/**
 * In development, send localhost to 127.0.0.1. OAuth redirect URIs and auth cookies are bound to
 * 127.0.0.1 (Spotify rejects "localhost"), so mixing the two hosts breaks sign in in confusing
 * ways.
 */
export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV === "development") {
    const host = req.headers.get("host") ?? "";
    if (host.startsWith("localhost:")) {
      const url = req.nextUrl.clone();
      url.hostname = "127.0.0.1";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg).*)"],
};
