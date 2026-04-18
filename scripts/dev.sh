#!/usr/bin/env bash
set -euo pipefail

POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-aia_insight}"
POSTGRES_DB="${POSTGRES_DB:-aia_insight}"
POSTGRES_READY_TIMEOUT_SECONDS="${POSTGRES_READY_TIMEOUT_SECONDS:-60}"

echo "Starting local Postgres service..."
docker compose up -d "${POSTGRES_SERVICE}"

echo "Waiting for Postgres to accept connections..."
deadline=$((SECONDS + POSTGRES_READY_TIMEOUT_SECONDS))

until docker compose exec -T "${POSTGRES_SERVICE}" pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; do
  if (( SECONDS >= deadline )); then
    echo "Postgres did not become ready within ${POSTGRES_READY_TIMEOUT_SECONDS}s." >&2
    echo "Check the Docker Compose logs with: docker compose logs ${POSTGRES_SERVICE}" >&2
    exit 1
  fi

  sleep 2
done

echo "Postgres is ready."

case "${npm_config_user_agent:-}" in
  pnpm/*)
    migrate_command=(pnpm db:migrate)
    ;;
  npm/*)
    migrate_command=(npm run db:migrate)
    ;;
  *)
    migrate_command=(pnpm db:migrate)
    ;;
esac

echo "Running database migrations..."
"${migrate_command[@]}"

echo "Starting Next.js dev server..."
exec next dev
