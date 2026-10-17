# syntax=docker/dockerfile:1.7
#
# Production image: the Next.js standalone server, with Prisma migrations applied on start.
#
#   docker build -t crossfade .
#   docker run --env-file .env.production -p 3000:3000 crossfade
#
# See docs/DEPLOYMENT.md for the full setup behind sleeep.dev/crossfade.

FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Env is validated at runtime in the container, not at build time.
ENV SKIP_ENV_VALIDATION=1
RUN npx prisma generate && npm run build

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 crossfade \
  && useradd --system --uid 1001 --gid crossfade crossfade \
  && npm install -g prisma@6.19.3 \
  && npm cache clean --force
COPY --from=build --chown=crossfade:crossfade /app/.next/standalone ./
COPY --from=build --chown=crossfade:crossfade /app/.next/static ./.next/static
COPY --from=build --chown=crossfade:crossfade /app/generated ./generated
COPY --from=build --chown=crossfade:crossfade /app/prisma ./prisma
COPY --chown=crossfade:crossfade deploy/docker-entrypoint.sh ./docker-entrypoint.sh
USER crossfade
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD node -e "fetch('http://127.0.0.1:3000/crossfade/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["./docker-entrypoint.sh"]
