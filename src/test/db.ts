import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { z } from "zod";

import * as schema from "@/db/schema";

const DEFAULT_TEST_DATABASE_URL =
  "postgres://aia_insight:aia_insight@localhost:5432/aia_insight_test";
const TEST_DATABASE_NAME_PATTERN = /(^|[_-])test($|[_-])/i;

const testEnvSchema = z.object({
  TEST_DATABASE_URL: z.string().url().optional(),
});

export function createTestDatabase() {
  const env = testEnvSchema.parse(process.env);
  const connectionString = assertTestDatabaseUrl(
    env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL,
  );
  const pool = new Pool({
    connectionString,
    ssl: false,
  });
  const db = drizzle(pool, { schema });

  return { db, pool };
}

export async function resetTestDatabase(
  db: ReturnType<typeof createTestDatabase>["db"],
) {
  assertTestDatabaseUrl(process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL);

  await db.execute(sql`
    truncate table
      "ingestion_run_items",
      "ingestion_runs",
      "documents"
    restart identity cascade
  `);
}

function assertTestDatabaseUrl(connectionString: string): string {
  const databaseName = extractDatabaseName(connectionString);

  if (!TEST_DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new Error(
      `Refusing to run destructive repository tests against non-test database "${databaseName}". ` +
        "Set TEST_DATABASE_URL to a database whose name includes 'test' as a segment.",
    );
  }

  return connectionString;
}

function extractDatabaseName(connectionString: string): string {
  const url = new URL(connectionString);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));

  if (databaseName.length === 0) {
    throw new Error("TEST_DATABASE_URL must include a database name.");
  }

  return databaseName;
}
