#!/usr/bin/env bash
set -euo pipefail

DEFAULT_TEST_DATABASE_URL="postgres://aia_insight:aia_insight@localhost:5432/aia_insight_test"

export TEST_DATABASE_URL="${TEST_DATABASE_URL:-$DEFAULT_TEST_DATABASE_URL}"
export DATABASE_URL="$TEST_DATABASE_URL"

node scripts/ensure-test-database.mjs
pnpm db:migrate
vitest run
