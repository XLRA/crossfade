#!/bin/sh
# Applies pending migrations, then starts the server. Set SKIP_MIGRATIONS=1 when several
# containers share one database and migrations run as a separate release step.
set -e

if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
  prisma migrate deploy --schema ./prisma/schema.prisma
fi

exec node server.js
