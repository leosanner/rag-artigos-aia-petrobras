#!/usr/bin/env bash
set -euo pipefail

APP_PORT="${PORT:-3000}"
INNGEST_APP_URL="${INNGEST_APP_URL:-http://localhost:${APP_PORT}/api/inngest}"

echo "Starting Inngest Dev Server for ${INNGEST_APP_URL}..."
echo "Dashboard: http://localhost:8288"

exec npx --yes --ignore-scripts=false inngest-cli@latest dev -u "${INNGEST_APP_URL}"
