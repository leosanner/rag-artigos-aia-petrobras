import { NextResponse } from "next/server";

import { isAuthorizedIngestionSyncRequest } from "@/application/ingestion/authorize-ingestion-sync";
import {
  indexingConflictResponseSchema,
  indexingInvalidRequestResponseSchema,
  indexingQueuedResponseSchema,
  indexingStartRequestSchema,
  indexingUnauthorizedResponseSchema,
} from "@/application/indexing/schemas";
import type { StartIndexingRun } from "@/application/indexing/start-indexing-run";

export type IndexingRunStartHandlerDeps = {
  startRun: StartIndexingRun;
  secret: string;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
const MALFORMED_JSON = Symbol("malformed-json");

export function createIndexingRunStartHandler(
  deps: IndexingRunStartHandlerDeps,
) {
  return async function POST(request: Request): Promise<Response> {
    const authorization = request.headers.get("authorization");

    if (!isAuthorizedIngestionSyncRequest(authorization, deps.secret)) {
      const body = indexingUnauthorizedResponseSchema.parse({
        error: "unauthorized",
      });
      return NextResponse.json(body, {
        status: 401,
        headers: NO_STORE_HEADERS,
      });
    }

    const raw = await request.json().catch(() => MALFORMED_JSON);

    if (raw === MALFORMED_JSON) {
      const body = indexingInvalidRequestResponseSchema.parse({
        error: "invalid_request",
      });
      return NextResponse.json(body, {
        status: 400,
        headers: NO_STORE_HEADERS,
      });
    }

    const parsed = indexingStartRequestSchema.safeParse(raw);

    if (!parsed.success) {
      const body = indexingInvalidRequestResponseSchema.parse({
        error: "invalid_request",
      });
      return NextResponse.json(body, {
        status: 400,
        headers: NO_STORE_HEADERS,
      });
    }

    const result = await deps.startRun.execute(parsed.data);

    if (result.kind === "conflict") {
      const body = indexingConflictResponseSchema.parse({
        activeRunId: result.activeRunId,
      });
      return NextResponse.json(body, {
        status: 409,
        headers: NO_STORE_HEADERS,
      });
    }

    const body = indexingQueuedResponseSchema.parse({
      runId: result.runId,
      status: "queued",
      documentId: result.documentId,
      force: result.force,
    });
    return NextResponse.json(body, {
      status: 202,
      headers: NO_STORE_HEADERS,
    });
  };
}
