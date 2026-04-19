#!/usr/bin/env bash
set -euo pipefail

APP_PORT="${PORT:-3000}"
INNGEST_APP_URL="${INNGEST_APP_URL:-http://localhost:${APP_PORT}/api/inngest}"
APP_READY_TIMEOUT_SECONDS="${APP_READY_TIMEOUT_SECONDS:-90}"

app_pid=""
inngest_pid=""

cleanup() {
  local exit_code=$?

  trap - EXIT INT TERM

  if [[ -n "${inngest_pid}" ]] && kill -0 "${inngest_pid}" >/dev/null 2>&1; then
    kill "${inngest_pid}" >/dev/null 2>&1 || true
  fi

  if [[ -n "${app_pid}" ]] && kill -0 "${app_pid}" >/dev/null 2>&1; then
    kill "${app_pid}" >/dev/null 2>&1 || true
  fi

  wait "${inngest_pid}" >/dev/null 2>&1 || true
  wait "${app_pid}" >/dev/null 2>&1 || true

  exit "${exit_code}"
}

trap cleanup EXIT INT TERM

echo "Starting app stack: Postgres, migrations, and Next.js..."
pnpm dev:app &
app_pid=$!

echo "Waiting for ${INNGEST_APP_URL} before starting Inngest..."
node - "${INNGEST_APP_URL}" "${APP_READY_TIMEOUT_SECONDS}" <<'NODE'
const url = process.argv[2];
const timeoutSeconds = Number(process.argv[3]);
const deadline = Date.now() + timeoutSeconds * 1000;

async function waitForApp() {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) {
        return;
      }
    } catch {
      // Next.js may still be booting.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.error(`App endpoint did not become ready within ${timeoutSeconds}s: ${url}`);
  process.exit(1);
}

await waitForApp();
NODE

echo "Starting Inngest Dev Server..."
pnpm dev:inngest &
inngest_pid=$!

set +e
wait -n "${app_pid}" "${inngest_pid}"
status=$?
set -e

exit "${status}"
