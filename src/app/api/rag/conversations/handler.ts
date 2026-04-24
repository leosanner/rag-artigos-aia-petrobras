import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedIngestionSyncRequest } from "@/application/ingestion/authorize-ingestion-sync";
import type { CreateConversation } from "@/application/rag/create-conversation";
import {
  ragInvalidRequestResponseSchema,
  ragTechnicalErrorResponseSchema,
  ragUnauthorizedResponseSchema,
} from "@/application/rag/schemas";

import { toCreateConversationHttpResponse } from "./dto";

export type RagConversationsHandlerDeps = {
  createConversation: Pick<CreateConversation, "execute">;
  secret: string;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
const MALFORMED_JSON = Symbol("malformed-json");
const createConversationRequestSchema = z.object({}).strict();

export function createRagConversationsHandler(
  deps: RagConversationsHandlerDeps,
) {
  return async function POST(request: Request): Promise<Response> {
    const authorization = request.headers.get("authorization");

    if (!isAuthorizedIngestionSyncRequest(authorization, deps.secret)) {
      return unauthorizedResponse();
    }

    const raw = await request.json().catch(() => MALFORMED_JSON);

    if (raw === MALFORMED_JSON) {
      return invalidRequestResponse();
    }

    const parsed = createConversationRequestSchema.safeParse(raw);

    if (!parsed.success) {
      return invalidRequestResponse();
    }

    try {
      const conversation = await deps.createConversation.execute();
      const body = toCreateConversationHttpResponse(conversation);

      return NextResponse.json(body, {
        status: 201,
        headers: NO_STORE_HEADERS,
      });
    } catch {
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

function technicalErrorResponse(): Response {
  const body = ragTechnicalErrorResponseSchema.parse({
    error: "technical_error",
  });

  return NextResponse.json(body, {
    status: 500,
    headers: NO_STORE_HEADERS,
  });
}
