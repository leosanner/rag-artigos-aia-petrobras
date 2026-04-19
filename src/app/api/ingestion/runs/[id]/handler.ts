import { NextResponse } from "next/server";

import type { GetIngestionRun } from "@/application/ingestion/get-ingestion-run";
import {
  ingestionRunDetailResponseSchema,
  ingestionRunIdParamSchema,
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
      return NextResponse.json(
        { error: "invalid_id" },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const run = await deps.getRun.execute(parsedId.data);

    if (!run) {
      return NextResponse.json(
        { error: "not_found" },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    const body = ingestionRunDetailResponseSchema.parse(run);
    return NextResponse.json(body, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  };
}
