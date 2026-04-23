import { GetQueryRun } from "@/application/rag/get-query-run";
import { db } from "@/db/client";
import { env } from "@/env/server";
import { RagQueryRunsRepository } from "@/repositories/rag-query-runs-repository";

import { createRagQueryRunDetailHandler } from "./handler";

export const dynamic = "force-dynamic";

const getRun = new GetQueryRun({
  runsRepository: new RagQueryRunsRepository(db),
});

export const GET = createRagQueryRunDetailHandler({
  getRun,
  secret: env.RAG_QUERY_SECRET ?? "",
});
