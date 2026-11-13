# Deploying Crossfade

Crossfade runs at **sleeep.dev/crossfade**. The main site, sleeep.dev, is a separate Next.js project
([heart](https://github.com/XLRA/heart)) hosted on Vercel. Crossfade needs a long-running Node server and a MySQL
database, so it runs in Docker on its own host, and sleeep.dev passes every request under `/crossfade` through to
it:

```
             https://sleeep.dev/crossfade/...
Browser  ─────────────────────────────────────▶  heart on Vercel
                                                     │  rewrites /crossfade/* to CROSSFADE_ORIGIN
                                                     ▼
                                         https://crossfade-origin.sleeep.dev/crossfade/...
                                                     │  Cloudflare Tunnel
                                                     ▼
                                    Docker host (Proxmox LXC or any Linux VM)
                                    ├─ tunnel  cloudflared, connects out to Cloudflare
                                    ├─ app     Crossfade, Next.js standalone, 127.0.0.1:3000
                                    └─ db      MySQL 8.4, private to the Compose network
```

This is the Next.js multi-zones pattern. Crossfade is built with the base path `/crossfade`, so every page, static
asset, API route and cookie already lives under that prefix: the rewrite maps paths one to one and never touches
heart's own routes.

The steps below go in order. Local development is covered in the [README](../README.md#running-it-locally).

## 1. What you need

- A Linux host with Docker Engine and the Compose plugin. On Proxmox, an unprivileged LXC with **nesting** and
  **keyctl** enabled runs Docker fine. Give it about 2 GB of memory for building the image; running it takes far
  less.
- Access to heart's Vercel project, to set one environment variable.
- A domain on Cloudflare for the tunnel hostname. It doesn't have to be sleeep.dev; any zone on the account works.
  (A reverse proxy with a TLS certificate works too, if the host has a public address.)
- A Spotify account with Premium (Spotify requires it to own a Development Mode app) and a Google account.

## 2. Spotify and Google apps

### Spotify

1. Open the [Spotify developer dashboard](https://developer.spotify.com/dashboard) and **Create app**. Tick
   **Web API** and **Web Playback SDK**.
2. Add both redirect URIs (they have to match exactly):
   - `https://sleeep.dev/crossfade/api/auth/callback/spotify`
   - `http://127.0.0.1:3000/crossfade/api/auth/callback/spotify` (local development)
3. Under **User Management**, add the Spotify account of everyone who should be able to sign in with Spotify.
   Development Mode allows five. Anyone else can still use Crossfade as a guest or with Google, and Spotify search
   works for them either way.
4. Copy the client ID and secret into `AUTH_SPOTIFY_ID` and `AUTH_SPOTIFY_SECRET`.

### Google and YouTube

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project and enable **YouTube Data
   API v3** under APIs & Services.
2. Set up the **OAuth consent screen** (Google Auth Platform) as an External app. Under **Branding**, set the home
   page to `https://sleeep.dev/crossfade` and the privacy policy to `https://sleeep.dev/crossfade/privacy`, and add
   `sleeep.dev` as an authorized domain. Google won't publish the app without both links. Then use **Audience →
   Publish app** so anyone can sign in, not just listed test users.

   Sign in only asks for `openid`, `email` and `profile`, which don't need Google's verification. Crossfade asks for
   `https://www.googleapis.com/auth/youtube.readonly` separately, only when someone imports their YouTube playlists.
   That scope is sensitive, so until the app is verified Google shows an "unverified app" warning at that step and
   caps it at 100 users.
3. Create an **OAuth client ID** of type Web application, with these authorized redirect URIs:
   - `https://sleeep.dev/crossfade/api/auth/callback/google`
   - `http://127.0.0.1:3000/crossfade/api/auth/callback/google`

   Copy its ID and secret into `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

4. Create an **API key** and restrict it to YouTube Data API v3. It's only used by the server, so restrict it by API
   rather than by website. It goes in `YOUTUBE_API_KEY`.

## 3. Configure the server

On the Docker host:

```bash
git clone <this repository> crossfade
cd crossfade
cp .env.example deploy/.env.production
echo "MYSQL_PASSWORD=$(openssl rand -hex 24)" > deploy/.env
chmod 600 deploy/.env deploy/.env.production
```

`deploy/.env` is read by Compose itself and sets the database password for both containers. Fill in
`deploy/.env.production` for the app:

| Variable                                 | Value                                                  |
| ---------------------------------------- | ------------------------------------------------------ |
| `AUTH_SECRET`                            | Output of `openssl rand -base64 32`                    |
| `AUTH_URL`                               | `https://sleeep.dev/crossfade/api/auth`                |
| `NEXT_PUBLIC_SITE_URL`                   | `https://sleeep.dev`                                   |
| `AUTH_SPOTIFY_ID`, `AUTH_SPOTIFY_SECRET` | From step 2                                            |
| `SPOTIFY_MARKET`                         | Two-letter country for search results, e.g. `US`       |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`   | From step 2                                            |
| `YOUTUBE_API_KEY`                        | From step 2                                            |
| `CONTACT_EMAIL`                          | Address for privacy questions, shown on `/privacy`     |
| `AUTH_DEV_LOGIN`                         | `false` (the developer login never runs in production) |

Delete the `DATABASE_URL` line: Compose builds it from `MYSQL_PASSWORD`. The server checks every variable against
the schema in `src/env.js` the first time it reads one, and a missing or malformed value fails with an error naming
it in the app's logs.

`AUTH_URL` is what makes sign-in work behind the rewrite. Requests reach the container under the tunnel's
hostname, but Auth.js builds every OAuth redirect from `AUTH_URL`, so Spotify and Google always send people back to
sleeep.dev.

## 4. Start it

```bash
docker compose -f deploy/docker-compose.prod.yml up -d --build
docker compose -f deploy/docker-compose.prod.yml logs -f app
```

The app container waits for MySQL to be healthy, applies any pending migrations, then starts. Check it from the
host:

```bash
curl http://127.0.0.1:3000/crossfade/api/health
# {"ok":true}
```

The health endpoint also queries the database, and the image's Docker health check polls it. Compose publishes the
app on the host's `127.0.0.1` only, and doesn't publish MySQL at all.

## 5. Give it an HTTPS origin

Vercel needs a public HTTPS address to forward to. A Cloudflare Tunnel provides one without opening ports on the
host, and the Compose file includes its connector, switched off by default:

1. In Cloudflare Zero Trust, go to **Networks → Tunnels → Create a tunnel** (type Cloudflared) and copy the token
   from the install command it shows.
2. Add a public hostname (a "published application route") for `crossfade-origin.sleeep.dev`, or any hostname on
   your zone, with the service `http://app:3000`.
3. Add two lines to `deploy/.env`, then run `docker compose -f deploy/docker-compose.prod.yml up -d` again:

   ```bash
   COMPOSE_PROFILES=tunnel
   CLOUDFLARE_TUNNEL_TOKEN=<the token>
   ```

Running `cloudflared` as a service on the host works too: use the dashboard's install command, and the service
`http://127.0.0.1:3000` instead.

Then, from anywhere:

```bash
curl https://crossfade-origin.sleeep.dev/crossfade/api/health
```

## 6. Point sleeep.dev/crossfade at it

In heart's Vercel project, open **Settings → Environment Variables** and add, for Production:

```
CROSSFADE_ORIGIN=https://crossfade-origin.sleeep.dev
```

Redeploy heart. Its `next.config.ts` rewrites `/crossfade` and `/crossfade/:path*` to that origin whenever the
variable is set. Then check the whole chain:

```bash
curl https://sleeep.dev/crossfade/api/health
```

Open https://sleeep.dev/crossfade, sign in with Spotify and with Google, make a playlist and play something from
each platform.

### Why the rewrite works without extra plumbing

- **One base path.** Pages, `/_next` assets, API routes and the OAuth callbacks are all under `/crossfade`, in
  development too, so nothing needs rewriting twice and heart never sees Crossfade's files.
- **Cookies stay in their lane.** Crossfade's cookies are named `crossfade.*` (with the `__Secure-` prefix over
  HTTPS) and scoped to `Path=/crossfade`, so the rest of sleeep.dev never receives them.
- **Server actions.** Next.js checks that a server action's `Origin` matches the host it arrives on. Behind the
  rewrite it arrives on the tunnel's hostname, so `next.config.js` allows `sleeep.dev` by name. Serving Crossfade
  under another domain means adding it there.
- **The bare origin.** A request for `/` on the origin redirects to `/crossfade`, and browsing works there, but
  signing in only works at sleeep.dev: OAuth always returns to sleeep.dev, and the cookies that sign-in sets are
  per host.

## Updating

```bash
cd crossfade
git pull
docker compose -f deploy/docker-compose.prod.yml up -d --build
```

Migrations run when the new container starts. If you ever run several app containers against one database, set
`SKIP_MIGRATIONS=1` on them and apply migrations once as a release step:

```bash
docker compose -f deploy/docker-compose.prod.yml run --rm --entrypoint prisma app   migrate deploy --schema ./prisma/schema.prisma
```

## Backups

Everything lives in MySQL, including uploaded playlist covers.

```bash
# Back up
docker compose -f deploy/docker-compose.prod.yml exec db \
  sh -c 'mysqldump --single-transaction -u crossfade -p"$MYSQL_PASSWORD" crossfade' > crossfade-$(date +%F).sql

# Restore
docker compose -f deploy/docker-compose.prod.yml exec -T db \
  sh -c 'mysql -u crossfade -p"$MYSQL_PASSWORD" crossfade' < crossfade-2026-11-12.sql
```

A Proxmox backup of the whole container also works; stop the stack first for a consistent copy.

## Troubleshooting

| What you see                                                  | What to check                                                                                                     |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Spotify says `INVALID_CLIENT: Invalid redirect URI`           | The redirect URI in the dashboard must be `AUTH_URL` followed by `/callback/spotify`, character for character.    |
| Spotify sign-in works for you but not for a friend            | Add their Spotify account under User Management. Development Mode only lets listed accounts in.                   |
| Google says `redirect_uri_mismatch`                           | Add `AUTH_URL` + `/callback/google` to the OAuth client's redirect URIs.                                          |
| Google blocks YouTube import ("app not verified")             | Add the person as a test user on the consent screen, or get the app verified.                                     |
| Sign-in ends up signed out, or loops back to the sign-in page | `AUTH_URL` must be the public sleeep.dev address. Open the app at sleeep.dev, not at the origin hostname.         |
| `Invalid Server Actions request` in the app logs              | The domain people use isn't in `serverActions.allowedOrigins` in `next.config.js`.                                |
| YouTube results disappear partway through the day             | The 10,000-unit daily quota is spent. It resets at midnight Pacific; Spotify results keep working.                |
| Every page errors with "Invalid environment variables"        | The app logs name the variable. Compare `deploy/.env.production` with `.env.example`.                             |
| The health check fails                                        | `docker compose -f deploy/docker-compose.prod.yml logs db`. The app reports unhealthy while it can't reach MySQL. |

## Running it somewhere else

The image is a plain Node.js server, so any host that runs containers works:

```bash
docker build -t crossfade .
docker run --env-file .env.production -e DATABASE_URL="mysql://user:password@host:3306/crossfade" -p 3000:3000 crossfade
```

It always serves under `/crossfade`. To give it the root of its own domain instead, change `BASE_PATH` in
`next.config.js`; the client reads the same value through `NEXT_PUBLIC_BASE_PATH`.
