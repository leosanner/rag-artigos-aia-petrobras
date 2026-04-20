import { NextResponse } from "next/server";

import type { GetIndexingRun } from "@/application/indexing/get-indexing-run";
import {
  indexingInvalidIdResponseSchema,
  indexingNotFoundResponseSchema,
  indexingRunDetailResponseSchema,
  indexingRunIdParamSchema,
} from "@/application/indexing/schemas";

export type IndexingRunDetailHandlerDeps = {
  getRun: GetIndexingRun;
};

export type IndexingRunDetailRouteContext = {
  params: Promise<{ id: string }>;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export function createIndexingRunDetailHandler(
  deps: IndexingRunDetailHandlerDeps,
) {
  return async function GET(
    _request: Request,
    context: IndexingRunDetailRouteContext,
  ): Promise<Response> {
    const { id } = await context.params;
    const parsedId = indexingRunIdParamSchema.safeParse(id);

    if (!parsedId.success) {
      const body = indexingInvalidIdResponseSchema.parse({
        error: "invalid_id",
      });
      return NextResponse.json(body, {
        status: 400,
        headers: NO_STORE_HEADERS,
      });
    }

    const run = await deps.getRun.execute(parsedId.data);

    if (!run) {
      const body = indexingNotFoundResponseSchema.parse({
        error: "not_found",
      });
      return NextResponse.json(body, {
        status: 404,
        headers: NO_STORE_HEADERS,
      });
    }

    const body = indexingRunDetailResponseSchema.parse(run);
    return NextResponse.json(body, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  };
}
