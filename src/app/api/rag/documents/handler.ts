import { NextResponse } from "next/server";

import { isAuthorizedIngestionSyncRequest } from "@/application/ingestion/authorize-ingestion-sync";
import type { ListRagDocuments } from "@/application/rag/list-rag-documents";
import {
  listRagDocumentsResponseSchema,
  ragTechnicalErrorResponseSchema,
  ragUnauthorizedResponseSchema,
} from "@/application/rag/schemas";

export type RagDocumentsHandlerDeps = {
  listDocuments: Pick<ListRagDocuments, "execute">;
  secret: string;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export function createRagDocumentsHandler(deps: RagDocumentsHandlerDeps) {
  return async function GET(request: Request): Promise<Response> {
    const authorization = request.headers.get("authorization");

    if (!isAuthorizedIngestionSyncRequest(authorization, deps.secret)) {
      return unauthorizedResponse();
    }

    try {
      const result = await deps.listDocuments.execute();
      const body = listRagDocumentsResponseSchema.parse(result);

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
  const body = ragTechnicalErrorResponseSchema.parse({
    error: "technical_error",
  });

  return NextResponse.json(body, {
    status: 500,
    headers: NO_STORE_HEADERS,
  });
}
