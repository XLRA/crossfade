/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/**
 * Crossfade is served from sleeep.dev/crossfade. The main site proxies everything under /crossfade
 * to this app (Next.js multi-zones), so every route, asset and API handler lives under the same
 * base path, locally too.
 */
const BASE_PATH = "/crossfade";

/** @type {import("next").NextConfig} */
const config = {
  basePath: BASE_PATH,
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },
  async redirects() {
    return [
      // Requests to the bare origin (e.g. hitting the container directly) land on the app.
      { source: "/", destination: BASE_PATH, basePath: false, permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // The players need autoplay (and Spotify's SDK, DRM) inside their iframes.
            value: [
              "camera=()",
              "microphone=()",
              "geolocation=()",
              'autoplay=(self "https://www.youtube.com" "https://open.spotify.com" "https://sdk.scdn.co")',
              'encrypted-media=(self "https://www.youtube.com" "https://open.spotify.com" "https://sdk.scdn.co")',
            ].join(", "),
          },
        ],
      },
    ];
  },
};

export default config;
