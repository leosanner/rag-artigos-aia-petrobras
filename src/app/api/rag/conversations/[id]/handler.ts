import { NextResponse } from "next/server";

import { isAuthorizedIngestionSyncRequest } from "@/application/ingestion/authorize-ingestion-sync";
import type { GetConversationDetail } from "@/application/rag/get-conversation-detail";
import {
  conversationIdParamSchema,
  conversationNotFoundResponseSchema,
  ragQueryRunInvalidIdResponseSchema,
  ragTechnicalErrorResponseSchema,
  ragUnauthorizedResponseSchema,
} from "@/application/rag/schemas";

import { toConversationDetailHttpResponse } from "../dto";

export type RagConversationDetailHandlerDeps = {
  getConversation: Pick<GetConversationDetail, "execute">;
  secret: string;
};

export type RagConversationDetailRouteContext = {
  params: Promise<{ id: string }>;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export function createRagConversationDetailHandler(
  deps: RagConversationDetailHandlerDeps,
) {
  return async function GET(
    request: Request,
    context: RagConversationDetailRouteContext,
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

    try {
      const result = await deps.getConversation.execute({ id: parsedId.data });

      if (result.status === "not_found") {
        return notFoundResponse();
      }

      const body = toConversationDetailHttpResponse(result.conversation);

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
