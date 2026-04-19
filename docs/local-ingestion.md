# Local Ingestion Usage

Quick guide for running F-01 locally: Google Drive -> Inngest -> Postgres.

## 1. Configure The Environment

Create `.env.local` from the example file:

```bash
cp .env.example .env.local
```

Fill at least these values:

```bash
DATABASE_URL="postgres://aia_insight:aia_insight@localhost:5432/aia_insight"
GOOGLE_DRIVE_FOLDER_ID="drive-folder-id"
GOOGLE_SERVICE_ACCOUNT_EMAIL="service-account@project.iam.gserviceaccount.com"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
INGESTION_SYNC_SECRET="local-operator-secret"
INNGEST_DEV="1"
```

Before running the app, share the Google Drive folder with the Service Account email as `Viewer`.

## 2. Add PDFs To The Folder

Add 1 to 3 PDFs to the folder configured as `GOOGLE_DRIVE_FOLDER_ID`.

Ingestion treats a file as PDF when:

- its MIME type is `application/pdf`, or
- its filename ends with `.pdf`.

Files whose `drive_file_id` already exists in the database are skipped.

## 3. Run The Full Local Stack

Use the automated flow:

```bash
pnpm dev:all
```

This command:

- starts local Postgres;
- applies migrations;
- starts Next.js;
- waits for `/api/inngest` to become ready;
- starts the Inngest Dev Server.

Useful URLs:

```text
App:     http://localhost:3000
Inngest: http://localhost:8288
```

If you prefer separate terminals:

```bash
pnpm dev:app
pnpm dev:inngest
```

## 4. Start A Run

Open:

```text
http://localhost:3000/ingestion
```

In the `Operator secret` field, enter the `INGESTION_SYNC_SECRET` value.

After starting, the page should:

- create a run with `queued` status;
- poll the run status;
- display aggregate counts and processed items;
- stop polling when the run reaches `completed` or `failed`.

## 5. Inspect The Database

```bash
docker compose exec postgres psql -U aia_insight -d aia_insight
```

Recent runs:

```sql
select id, status, selected_count, processed_count, failed_count, skipped_existing_count, last_error
from ingestion_runs
order by created_at desc
limit 5;
```

Recent documents:

```sql
select title, status, pipeline_version, length(raw_text), length(refined_text), last_error
from documents
order by created_at desc
limit 10;
```

## Common Issues

- `401` when starting: the submitted secret does not match `INGESTION_SYNC_SECRET`.
- Run stays `queued`: the Inngest Dev Server is not running or did not sync `/api/inngest`.
- `drive_listing_failed`: check `GOOGLE_DRIVE_FOLDER_ID`, Drive API enablement, and Service Account access to the folder.
- `drive_download_failed`: check file read permissions and whether the PDFs are accessible by the Service Account.
- No new documents: files may already exist in the database by `drive_file_id`.

## Checks

Before considering the environment ready:

```bash
pnpm lint
pnpm typecheck
pnpm test
```
