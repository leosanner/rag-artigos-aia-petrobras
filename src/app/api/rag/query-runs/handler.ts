import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedIngestionSyncRequest } from "@/application/ingestion/authorize-ingestion-sync";
import type { ListQueryRuns } from "@/application/rag/list-query-runs";
import {
  ragQueryRunSummariesResponseSchema,
  ragUnauthorizedResponseSchema,
} from "@/application/rag/schemas";

export type RagQueryRunsHandlerDeps = {
  listRuns: Pick<ListQueryRuns, "execute">;
  secret: string;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
const technicalErrorResponseBodySchema = z
  .object({
    error: z.literal("technical_error"),
  })
  .strip();

export function createRagQueryRunsHandler(deps: RagQueryRunsHandlerDeps) {
  return async function GET(request: Request): Promise<Response> {
    const authorization = request.headers.get("authorization");

    if (!isAuthorizedIngestionSyncRequest(authorization, deps.secret)) {
      return unauthorizedResponse();
    }

    try {
      const runs = await deps.listRuns.execute();
      const body = ragQueryRunSummariesResponseSchema.parse(
        runs.map((run) => ({
          id: run.id,
          question: run.question,
          status: run.status,
          topK: run.topK,
          retrievalStrategy: run.retrievalStrategy,
          latencyMs: run.latencyMs,
          totalCostUsd: run.totalCostUsd,
          createdAt: run.createdAt.toISOString(),
        })),
      );

      return NextResponse.json(body, {
        status: 200,
        headers: NO_STORE_HEADERS,
      });
    } catch {
      return technicalErrorResponse();
    }
  };
}

function unauthorizedResponse(): Response {
  const body = ragUnauthorizedResponseSchema.parse({
    error: "unauthorized",
  });

  return NextResponse.json(body, {
    status: 401,
    headers: NO_STORE_HEADERS,
  });
}

function technicalErrorResponse(): Response {
  const body = technicalErrorResponseBodySchema.parse({
    error: "technical_error",
  });

  return NextResponse.json(body, {
    status: 500,
    headers: NO_STORE_HEADERS,
  });
}
