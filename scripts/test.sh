#!/usr/bin/env bash
set -euo pipefail

DEFAULT_TEST_DATABASE_URL="postgres://aia_insight:aia_insight@localhost:5432/aia_insight_test"

export TEST_DATABASE_URL="${TEST_DATABASE_URL:-$DEFAULT_TEST_DATABASE_URL}"
export DATABASE_URL="$TEST_DATABASE_URL"
export GOOGLE_DRIVE_FOLDER_ID="${GOOGLE_DRIVE_FOLDER_ID:-test-drive-folder}"
export GOOGLE_SERVICE_ACCOUNT_EMAIL="${GOOGLE_SERVICE_ACCOUNT_EMAIL:-test-service-account@example.iam.gserviceaccount.com}"
DEFAULT_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----\\n"
export GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="${GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:-$DEFAULT_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY}"
export INGESTION_SYNC_SECRET="${INGESTION_SYNC_SECRET:-test-ingestion-sync-secret}"
export INNGEST_DEV="${INNGEST_DEV:-1}"

node scripts/ensure-test-database.mjs
pnpm db:migrate
vitest run
