import { z } from "zod";

export const healthCheckStatusSchema = z.enum(["ok", "unavailable"]);

export const healthCheckNameSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9_-]*$/,
    "check name must start with a lowercase letter and contain only [a-z0-9_-]",
  );

export const healthCheckResultSchema = z.object({
  status: healthCheckStatusSchema,
  latencyMs: z.number().int().nonnegative(),
});

export const healthAggregateStatusSchema = z.enum(["ok", "degraded"]);

export const healthResponseSchema = z.object({
  status: healthAggregateStatusSchema,
  timestamp: z.string().datetime(),
  version: z.string().min(1),
  checks: z.record(healthCheckNameSchema, healthCheckResultSchema),
});

export type HealthCheckStatus = z.infer<typeof healthCheckStatusSchema>;
export type HealthCheckName = z.infer<typeof healthCheckNameSchema>;
export type HealthCheckResult = z.infer<typeof healthCheckResultSchema>;
export type HealthAggregateStatus = z.infer<typeof healthAggregateStatusSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
