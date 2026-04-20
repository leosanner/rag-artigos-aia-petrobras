import type { PoolConfig } from "pg";

const SSL_MODES_WITH_CURRENT_VERIFY_FULL_BEHAVIOR = new Set([
  "prefer",
  "require",
  "verify-ca",
]);

export function buildPoolConfig(
  databaseUrl: string,
  nodeEnv = process.env.NODE_ENV,
): PoolConfig {
  return {
    connectionString: normalizePgConnectionString(databaseUrl),
    ssl: nodeEnv !== "development" ? true : false,
  };
}

export function normalizePgConnectionString(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get("sslmode");
  const useLibpqCompat = url.searchParams.get("uselibpqcompat");

  if (
    sslMode &&
    useLibpqCompat !== "true" &&
    SSL_MODES_WITH_CURRENT_VERIFY_FULL_BEHAVIOR.has(sslMode)
  ) {
    url.searchParams.set("sslmode", "verify-full");
  }

  return url.toString();
}
