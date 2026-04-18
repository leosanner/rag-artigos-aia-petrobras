import { Pool } from "pg";

const DEFAULT_TEST_DATABASE_URL =
  "postgres://aia_insight:aia_insight@localhost:5432/aia_insight_test";
const TEST_DATABASE_NAME_PATTERN = /(^|[_-])test($|[_-])/i;

const connectionString =
  process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
const testDatabaseUrl = new URL(connectionString);
const databaseName = decodeURIComponent(testDatabaseUrl.pathname.replace(/^\//, ""));

if (!TEST_DATABASE_NAME_PATTERN.test(databaseName)) {
  throw new Error(
    `Refusing to prepare non-test database "${databaseName}". ` +
      "Set TEST_DATABASE_URL to a database whose name includes 'test' as a segment.",
  );
}

const maintenanceDatabaseUrl = new URL(testDatabaseUrl);
maintenanceDatabaseUrl.pathname = "/postgres";

const maintenancePool = new Pool({
  connectionString: maintenanceDatabaseUrl.toString(),
});

try {
  const existing = await maintenancePool.query(
    "select 1 from pg_database where datname = $1",
    [databaseName],
  );

  if (existing.rowCount === 0) {
    await maintenancePool.query(`create database ${quoteIdentifier(databaseName)}`);
  }
} finally {
  await maintenancePool.end();
}

const testPool = new Pool({ connectionString });

try {
  await testPool.query("create extension if not exists vector");
} finally {
  await testPool.end();
}

console.log(`Test database ready: ${databaseName}`);

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}
