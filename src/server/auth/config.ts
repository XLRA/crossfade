import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Spotify from "next-auth/providers/spotify";

import { env } from "~/env";
import { BASE_PATH } from "~/lib/base-path";
import { db } from "~/server/db";
import { GOOGLE_SIGNIN_SCOPES, SPOTIFY_SCOPES } from "./scopes";
import { generateUsername } from "./username";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

export const enabledProviders = {
  spotify: Boolean(env.AUTH_SPOTIFY_ID && env.AUTH_SPOTIFY_SECRET),
  google: Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET),
  dev: env.AUTH_DEV_LOGIN === "true" && env.NODE_ENV !== "production",
};

/*
 * Cookies are scoped to /crossfade so the rest of sleeep.dev never sees them, and renamed so they
 * can't collide with anything else on the domain. (`__Host-` names would require Path=/.)
 */
const secureCookies = env.AUTH_URL
  ? env.AUTH_URL.startsWith("https://")
  : env.NODE_ENV === "production";
const prefix = secureCookies ? "__Secure-" : "";
const cookie = { httpOnly: true, sameSite: "lax" as const, path: BASE_PATH, secure: secureCookies };

const providers: NextAuthConfig["providers"] = [];

if (enabledProviders.spotify) {
  providers.push(
    Spotify({
      clientId: env.AUTH_SPOTIFY_ID,
      clientSecret: env.AUTH_SPOTIFY_SECRET,
      authorization: {
        url: "https://accounts.spotify.com/authorize",
        params: { scope: SPOTIFY_SCOPES.join(" ") },
      },
    }),
  );
}

if (enabledProviders.google) {
  providers.push(
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: { scope: GOOGLE_SIGNIN_SCOPES.join(" "), prompt: "select_account" },
      },
      // Google only hands out verified addresses, so a Google sign-in may attach to an account
      // that was created with Spotify under the same email. The reverse is not allowed, because
      // Spotify doesn't guarantee the address was verified.
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

if (enabledProviders.dev) {
  providers.push(
    Credentials({
      id: "dev-login",
      name: "Developer login",
      credentials: { username: { label: "Username", type: "text" } },
      async authorize(credentials) {
        const raw = typeof credentials?.username === "string" ? credentials.username : "";
        const username = raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
        if (username.length < 3) return null;
        const user = await db.user.upsert({
          where: { username },
          update: {},
          create: {
            username,
            name: username.charAt(0).toUpperCase() + username.slice(1),
            email: `${username}@dev.crossfade.local`,
          },
        });
        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  );
}

export const authConfig = {
  basePath: `${BASE_PATH}/api/auth`,
  trustHost: true,
  adapter: PrismaAdapter(db),
  // JWT sessions: no session lookup per request, and the dev credentials provider needs them.
  // OAuth tokens never go in the JWT; they stay in the Account table on the server.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  providers,
  pages: {
    signIn: `${BASE_PATH}/signin`,
    error: `${BASE_PATH}/signin`,
  },
  cookies: {
    sessionToken: { name: `${prefix}crossfade.session`, options: cookie },
    callbackUrl: { name: `${prefix}crossfade.callback-url`, options: cookie },
    csrfToken: { name: `${prefix}crossfade.csrf`, options: cookie },
    pkceCodeVerifier: {
      name: `${prefix}crossfade.pkce`,
      options: { ...cookie, maxAge: 60 * 15 },
    },
    state: { name: `${prefix}crossfade.state`, options: { ...cookie, maxAge: 60 * 15 } },
    nonce: { name: `${prefix}crossfade.nonce`, options: cookie },
  },
  callbacks: {
    /**
     * Auth.js only writes tokens when an account is first linked. Signing in again (or granting
     * extra scopes later) should replace them, otherwise we keep using expired tokens and old
     * scopes. Runs before the adapter links a new account, so new accounts are unaffected.
     */
    async signIn({ account }) {
      if (account && (account.type === "oauth" || account.type === "oidc")) {
        await db.account.updateMany({
          where: { provider: account.provider, providerAccountId: account.providerAccountId },
          data: {
            access_token: account.access_token ?? null,
            expires_at: account.expires_at ?? null,
            token_type: account.token_type ?? null,
            scope: account.scope ?? null,
            id_token: account.id_token ?? null,
            // Google only returns a refresh token on the consent screen; keep the old one otherwise.
            ...(account.refresh_token ? { refresh_token: account.refresh_token } : {}),
          },
        });
      }
      return true;
    },
    /** Only ever send people back into the app, as an absolute URL on the same origin. */
    redirect({ url, baseUrl }) {
      const origin = new URL(baseUrl).origin;
      if (url.startsWith("/") && !url.startsWith("//")) return `${origin}${url}`;
      try {
        if (new URL(url).origin === origin) return url;
      } catch {
        // fall through
      }
      return `${origin}${BASE_PATH}`;
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      return {
        ...session,
        user: { ...session.user, id: token.sub ?? "" },
      };
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      const username = await generateUsername(db, [user.name, user.email]);
      await db.user.update({ where: { id: user.id }, data: { username } });
    },
  },
} satisfies NextAuthConfig;
