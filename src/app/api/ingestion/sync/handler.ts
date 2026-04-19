import { NextResponse } from "next/server";

import { isAuthorizedIngestionSyncRequest } from "@/application/ingestion/authorize-ingestion-sync";
import {
  ingestionSyncConflictResponseSchema,
  ingestionSyncQueuedResponseSchema,
  ingestionSyncUnauthorizedResponseSchema,
} from "@/application/ingestion/schemas";
import type { StartIngestionRun } from "@/application/ingestion/start-ingestion-run";

export type SyncHandlerDeps = {
  startRun: StartIngestionRun;
  secret: string;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export function createSyncHandler(deps: SyncHandlerDeps) {
  return async function POST(request: Request): Promise<Response> {
    const authorization = request.headers.get("authorization");

    if (!isAuthorizedIngestionSyncRequest(authorization, deps.secret)) {
      const body = ingestionSyncUnauthorizedResponseSchema.parse({
        error: "unauthorized",
      });
      return NextResponse.json(body, {
        status: 401,
        headers: NO_STORE_HEADERS,
      });
    }

    const result = await deps.startRun.execute();

    if (result.kind === "conflict") {
      const body = ingestionSyncConflictResponseSchema.parse({
        activeRunId: result.activeRunId,
      });
      return NextResponse.json(body, {
        status: 409,
        headers: NO_STORE_HEADERS,
      });
    }

    const body = ingestionSyncQueuedResponseSchema.parse({
      runId: result.runId,
      status: "queued",
      maxDocuments: result.maxDocuments,
    });
    return NextResponse.json(body, {
      status: 202,
      headers: NO_STORE_HEADERS,
    });
  };
}
