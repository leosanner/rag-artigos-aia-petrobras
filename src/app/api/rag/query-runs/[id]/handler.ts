import { NextResponse } from "next/server";

import { isAuthorizedIngestionSyncRequest } from "@/application/ingestion/authorize-ingestion-sync";
import type { GetQueryRun } from "@/application/rag/get-query-run";
import {
  ragQueryRunDetailResponseSchema,
  ragQueryRunIdParamSchema,
  ragQueryRunInvalidIdResponseSchema,
  ragQueryRunNotFoundResponseSchema,
  ragUnauthorizedResponseSchema,
} from "@/application/rag/schemas";

export type RagQueryRunDetailHandlerDeps = {
  getRun: Pick<GetQueryRun, "execute">;
  secret: string;
};

export type RagQueryRunDetailRouteContext = {
  params: Promise<{ id: string }>;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export function createRagQueryRunDetailHandler(
  deps: RagQueryRunDetailHandlerDeps,
) {
  return async function GET(
    request: Request,
    context: RagQueryRunDetailRouteContext,
  ): Promise<Response> {
    const authorization = request.headers.get("authorization");

    if (!isAuthorizedIngestionSyncRequest(authorization, deps.secret)) {
      return unauthorizedResponse();
    }

    const { id } = await context.params;
    const parsedId = ragQueryRunIdParamSchema.safeParse(id);

    if (!parsedId.success) {
      return invalidIdResponse();
    }

    const run = await deps.getRun.execute(parsedId.data);

    if (!run) {
      return notFoundResponse();
    }

    const body = ragQueryRunDetailResponseSchema.parse({
      id: run.id,
      question: run.question,
      answer: run.answer,
      mode: run.mode,
      status: run.status,
      errorCode: run.errorCode,
      sources: run.sources,
      relatedTerms: run.relatedTerms,
      metadata: run.metadata,
      audit: run.audit,
      createdAt: run.createdAt.toISOString(),
    });

    return NextResponse.json(body, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
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

function invalidIdResponse(): Response {
  const body = ragQueryRunInvalidIdResponseSchema.parse({
    error: "invalid_id",
  });

  return NextResponse.json(body, {
    status: 400,
    headers: NO_STORE_HEADERS,
  });
}

function notFoundResponse(): Response {
  const body = ragQueryRunNotFoundResponseSchema.parse({
    error: "not_found",
  });

  return NextResponse.json(body, {
    status: 404,
    headers: NO_STORE_HEADERS,
  });
}
