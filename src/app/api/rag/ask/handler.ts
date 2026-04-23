import { NextResponse } from "next/server";

import { isAuthorizedIngestionSyncRequest } from "@/application/ingestion/authorize-ingestion-sync";
import type { AnswerQuestion } from "@/application/rag/answer-question";
import {
  answerQuestionResultSchema,
  ragAskRequestSchema,
  ragAskSuccessResponseSchema,
  ragGenerationFailedResponseSchema,
  ragGenerationUnavailableResponseSchema,
  ragInvalidRequestResponseSchema,
  ragUnauthorizedResponseSchema,
} from "@/application/rag/schemas";

export type RagAskHandlerDeps = {
  answerQuestion: Pick<AnswerQuestion, "execute">;
  secret: string;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
const MALFORMED_JSON = Symbol("malformed-json");

export function createRagAskHandler(deps: RagAskHandlerDeps) {
  return async function POST(request: Request): Promise<Response> {
    const authorization = request.headers.get("authorization");

    if (!isAuthorizedIngestionSyncRequest(authorization, deps.secret)) {
      return unauthorizedResponse();
    }

    const raw = await request.json().catch(() => MALFORMED_JSON);

    if (raw === MALFORMED_JSON) {
      return invalidRequestResponse();
    }

    const parsed = ragAskRequestSchema.safeParse(raw);

    if (!parsed.success) {
      return invalidRequestResponse();
    }

    let rawResult: unknown;
    try {
      rawResult = await deps.answerQuestion.execute(parsed.data);
    } catch {
      return generationUnavailableResponse();
    }

    const parsedResult = answerQuestionResultSchema.safeParse(rawResult);

    if (!parsedResult.success) {
      return generationFailedResponse();
    }

    const result = parsedResult.data;

    if (result.kind === "answered") {
      const body = ragAskSuccessResponseSchema.safeParse(result);

      if (!body.success) {
        return generationFailedResponse();
      }

      return NextResponse.json(body.data, {
        status: 200,
        headers: NO_STORE_HEADERS,
      });
    }

    if (result.error === "generation_failed") {
      return generationFailedResponse();
    }

    return generationUnavailableResponse();
  };
}

function invalidRequestResponse(): Response {
  const body = ragInvalidRequestResponseSchema.parse({
    error: "invalid_request",
  });

  return NextResponse.json(body, {
    status: 400,
    headers: NO_STORE_HEADERS,
  });
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

function generationFailedResponse(): Response {
  const body = ragGenerationFailedResponseSchema.parse({
    error: "generation_failed",
  });

  return NextResponse.json(body, {
    status: 502,
    headers: NO_STORE_HEADERS,
  });
}

function generationUnavailableResponse(): Response {
  const body = ragGenerationUnavailableResponseSchema.parse({
    error: "generation_unavailable",
  });

  return NextResponse.json(body, {
    status: 503,
    headers: NO_STORE_HEADERS,
  });
}
