import { NextResponse } from "next/server";

import packageJson from "../../../../package.json";
import { checkHealth } from "@/application/health/check-health";
import { appCheck } from "@/application/health/checks/app";
import { createDatabaseCheck } from "@/application/health/checks/database";
import { healthResponseSchema } from "@/application/health/schemas";
import { db } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await checkHealth([appCheck, createDatabaseCheck(db)]);

  const body = healthResponseSchema.parse({
    status: report.status,
    timestamp: new Date().toISOString(),
    version: packageJson.version,
    checks: report.checks,
  });

  return NextResponse.json(body, {
    status: body.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
