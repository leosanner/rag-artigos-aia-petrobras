import { NextResponse } from "next/server";

import type { GetIngestionRun } from "@/application/ingestion/get-ingestion-run";
import {
  ingestionRunDetailResponseSchema,
  ingestionRunIdParamSchema,
  ingestionRunInvalidIdResponseSchema,
  ingestionRunNotFoundResponseSchema,
} from "@/application/ingestion/schemas";

export type RunDetailHandlerDeps = {
  getRun: GetIngestionRun;
};

export type RunDetailRouteContext = {
  params: Promise<{ id: string }>;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export function createRunDetailHandler(deps: RunDetailHandlerDeps) {
  return async function GET(
    _request: Request,
    context: RunDetailRouteContext,
  ): Promise<Response> {
    const { id } = await context.params;
    const parsedId = ingestionRunIdParamSchema.safeParse(id);

    if (!parsedId.success) {
      const body = ingestionRunInvalidIdResponseSchema.parse({
        error: "invalid_id",
      });
      return NextResponse.json(body, {
        status: 400,
        headers: NO_STORE_HEADERS,
      });
    }

    const run = await deps.getRun.execute(parsedId.data);

    if (!run) {
      const body = ingestionRunNotFoundResponseSchema.parse({
        error: "not_found",
      });
      return NextResponse.json(body, {
        status: 404,
        headers: NO_STORE_HEADERS,
      });
    }

    const body = ingestionRunDetailResponseSchema.parse(run);
    return NextResponse.json(body, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  };
}
