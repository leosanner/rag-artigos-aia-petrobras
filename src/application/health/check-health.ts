import type {
  HealthAggregateStatus,
  HealthCheckResult,
} from "./schemas";

export type HealthCheck = {
  name: string;
  run: () => Promise<void>;
};

export type HealthReport = {
  status: HealthAggregateStatus;
  checks: Record<string, HealthCheckResult>;
};

export async function checkHealth(
  checks: readonly HealthCheck[],
): Promise<HealthReport> {
  const entries = await Promise.all(
    checks.map(async ({ name, run }) => {
      const startedAt = Date.now();
      try {
        await run();
        return [
          name,
          { status: "ok", latencyMs: Date.now() - startedAt },
        ] as const;
      } catch (error) {
        console.error(`[health] check "${name}" failed`, error);
        return [
          name,
          { status: "unavailable", latencyMs: Date.now() - startedAt },
        ] as const;
      }
    }),
  );

  const checksByName = Object.fromEntries(entries) as Record<
    string,
    HealthCheckResult
  >;
  const allOk = entries.every(([, result]) => result.status === "ok");

  return {
    status: allOk ? "ok" : "degraded",
    checks: checksByName,
  };
}
