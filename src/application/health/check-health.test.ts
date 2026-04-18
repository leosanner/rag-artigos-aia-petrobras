import { describe, expect, it, vi } from "vitest";

import { checkHealth } from "./check-health";
import {
  healthCheckResultSchema,
  healthResponseSchema,
} from "./schemas";

describe("checkHealth", () => {
  it("aggregates status 'ok' when every check resolves", async () => {
    const report = await checkHealth([
      { name: "app", run: async () => {} },
      { name: "database", run: async () => {} },
    ]);

    expect(report.status).toBe("ok");
    expect(report.checks.app.status).toBe("ok");
    expect(report.checks.database.status).toBe("ok");
  });

  it("marks only the failing check as unavailable and aggregates to 'degraded'", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const report = await checkHealth([
      { name: "app", run: async () => {} },
      {
        name: "database",
        run: async () => {
          throw new Error("connection refused");
        },
      },
    ]);

    expect(report.status).toBe("degraded");
    expect(report.checks.app.status).toBe("ok");
    expect(report.checks.database.status).toBe("unavailable");
  });

  it("reports a non-negative integer latencyMs for every check, success or failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const report = await checkHealth([
      { name: "fast", run: async () => {} },
      {
        name: "slow-fail",
        run: async () => {
          throw new Error("boom");
        },
      },
    ]);

    for (const result of Object.values(report.checks)) {
      expect(result).toMatchObject(healthCheckResultSchema.parse(result));
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result.latencyMs)).toBe(true);
    }
  });

  it("logs failing checks to console.error with the original error, not to the response body", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const secret = "SECRET_CONNECTION_STRING_postgres://user:pass@host/db";
    const originalError = new Error(secret);

    const report = await checkHealth([
      {
        name: "database",
        run: async () => {
          throw originalError;
        },
      },
    ]);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [, loggedError] = errorSpy.mock.calls[0] ?? [];
    expect(loggedError).toBe(originalError);

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("Error");
    expect(serialized).not.toContain("postgres://");
  });

  it("produces a body that passes healthResponseSchema.parse once timestamp and version are attached", async () => {
    const report = await checkHealth([
      { name: "app", run: async () => {} },
      { name: "database", run: async () => {} },
    ]);

    const body = {
      status: report.status,
      timestamp: new Date().toISOString(),
      version: "0.1.0",
      checks: report.checks,
    };

    expect(() => healthResponseSchema.parse(body)).not.toThrow();
  });

  it("rejects check names that could smuggle sensitive strings as response keys", async () => {
    const report = await checkHealth([
      {
        name: "postgres://user:pass@host/db",
        run: async () => {},
      },
    ]);

    const body = {
      status: report.status,
      timestamp: new Date().toISOString(),
      version: "0.1.0",
      checks: report.checks,
    };

    expect(() => healthResponseSchema.parse(body)).toThrow();
  });

  it("accepts conventional identifier-style check names", async () => {
    const report = await checkHealth([
      { name: "app", run: async () => {} },
      { name: "database", run: async () => {} },
      { name: "google-drive", run: async () => {} },
      { name: "llm_provider", run: async () => {} },
    ]);

    const body = {
      status: report.status,
      timestamp: new Date().toISOString(),
      version: "0.1.0",
      checks: report.checks,
    };

    expect(() => healthResponseSchema.parse(body)).not.toThrow();
  });

  it("runs checks concurrently rather than sequentially", async () => {
    const started: number[] = [];
    const makeCheck = (name: string, delayMs: number) => ({
      name,
      run: async () => {
        started.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      },
    });

    const start = Date.now();
    await checkHealth([
      makeCheck("a", 40),
      makeCheck("b", 40),
      makeCheck("c", 40),
    ]);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(120);
    expect(started).toHaveLength(3);
    expect(Math.max(...started) - Math.min(...started)).toBeLessThan(20);
  });
});
