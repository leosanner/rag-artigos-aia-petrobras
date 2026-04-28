import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { isAuthorizedIngestionSyncRequest } from "@/application/ingestion/authorize-ingestion-sync";
import type { AppendConversationMessage } from "@/application/rag/append-conversation-message";
import {
  appendConversationMessageRequestSchema,
  conversationIdParamSchema,
  conversationNotFoundResponseSchema,
  ragInvalidRequestResponseSchema,
  ragQueryRunInvalidIdResponseSchema,
  ragTechnicalErrorResponseSchema,
  ragUnauthorizedResponseSchema,
} from "@/application/rag/schemas";
import { logRagError } from "@/infrastructure/observability/log-rag-error";

import { toAppendConversationMessageHttpResponse } from "../../dto";

export type RagConversationMessagesHandlerDeps = {
  appendMessage: Pick<AppendConversationMessage, "execute">;
  secret: string;
};

export type RagConversationMessagesRouteContext = {
  params: Promise<{ id: string }>;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
const MALFORMED_JSON = Symbol("malformed-json");

export function createRagConversationMessagesHandler(
  deps: RagConversationMessagesHandlerDeps,
) {
  return async function POST(
    request: Request,
    context: RagConversationMessagesRouteContext,
  ): Promise<Response> {
    const authorization = request.headers.get("authorization");

    if (!isAuthorizedIngestionSyncRequest(authorization, deps.secret)) {
      return unauthorizedResponse();
    }

    const { id } = await context.params;
    const parsedId = conversationIdParamSchema.safeParse(id);

    if (!parsedId.success) {
      return invalidIdResponse();
    }

    const raw = await request.json().catch(() => MALFORMED_JSON);

    if (raw === MALFORMED_JSON) {
      return invalidRequestResponse();
    }

    const parsedBody = appendConversationMessageRequestSchema.safeParse(raw);

    if (!parsedBody.success) {
      return invalidRequestResponse();
    }

    const requestTraceId = randomUUID().slice(0, 8);

    try {
      const appendInput =
        parsedBody.data.mode === "focused"
          ? {
              conversationId: parsedId.data,
              userMessageContent: parsedBody.data.content,
              retrievalSettings: parsedBody.data.retrievalSettings,
              mode: "focused" as const,
              documentId: parsedBody.data.documentId,
              requestTraceId,
            }
          : {
              conversationId: parsedId.data,
              userMessageContent: parsedBody.data.content,
              retrievalSettings: parsedBody.data.retrievalSettings,
              requestTraceId,
            };
      const result = await deps.appendMessage.execute(appendInput);

      if (result.status === "not_found") {
        return notFoundResponse();
      }

      const body = toAppendConversationMessageHttpResponse(result);
      const status =
        result.status === "generation_failed"
          ? 502
          : result.status === "generation_unavailable"
            ? 503
            : result.status === "document_not_found"
              ? 404
              : result.status === "document_not_focusable"
                ? 422
            : 200;

      return NextResponse.json(body, {
        status,
        headers: NO_STORE_HEADERS,
      });
    } catch (error) {
      logRagError(
        "handler.append_message_failed",
        { requestTraceId, conversationId: parsedId.data },
        error,
      );
      return technicalErrorResponse();
    }
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
  const body = conversationNotFoundResponseSchema.parse({
    error: "not_found",
  });

  return NextResponse.json(body, {
    status: 404,
    headers: NO_STORE_HEADERS,
  });
}

function technicalErrorResponse(): Response {
  const body = ragTechnicalErrorResponseSchema.parse({
    error: "technical_error",
  });

  return NextResponse.json(body, {
    status: 500,
    headers: NO_STORE_HEADERS,
  });
}
