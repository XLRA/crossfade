import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const optional = z.string().optional();

export const env = createEnv({
  /**
   * Server-side environment variables. Validated at build and boot so a misconfigured
   * container fails loudly instead of half working.
   */
  server: {
    AUTH_SECRET: process.env.NODE_ENV === "production" ? z.string() : optional,
    /** Public URL of the auth routes, e.g. https://sleeep.dev/crossfade/api/auth */
    AUTH_URL: z.string().url().optional(),
    AUTH_SPOTIFY_ID: optional,
    AUTH_SPOTIFY_SECRET: optional,
    /** Country used for Spotify search and lookups, so results are playable there. */
    SPOTIFY_MARKET: z
      .string()
      .regex(/^[A-Z]{2}$/, "Use a two-letter country code")
      .default("US"),
    AUTH_GOOGLE_ID: optional,
    AUTH_GOOGLE_SECRET: optional,
    /** Local-only username login so the app can be exercised without OAuth apps. */
    AUTH_DEV_LOGIN: z.enum(["true", "false"]).optional(),
    YOUTUBE_API_KEY: optional,
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },

  /**
   * Client-side variables. Must be prefixed with `NEXT_PUBLIC_`.
   */
  client: {
    /** Origin the app is reached at, used for share links rendered on the server. */
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  },

  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    AUTH_SPOTIFY_ID: process.env.AUTH_SPOTIFY_ID,
    AUTH_SPOTIFY_SECRET: process.env.AUTH_SPOTIFY_SECRET,
    SPOTIFY_MARKET: process.env.SPOTIFY_MARKET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    AUTH_DEV_LOGIN: process.env.AUTH_DEV_LOGIN,
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. Used by the Docker
   * build, where secrets are only provided at runtime.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
