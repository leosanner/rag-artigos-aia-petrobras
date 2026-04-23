import { ListQueryRuns } from "@/application/rag/list-query-runs";
import { db } from "@/db/client";
import { env } from "@/env/server";
import { RagQueryRunsRepository } from "@/repositories/rag-query-runs-repository";

import { createRagQueryRunsHandler } from "./handler";

export const dynamic = "force-dynamic";

const listRuns = new ListQueryRuns({
  runsRepository: new RagQueryRunsRepository(db),
});

export const GET = createRagQueryRunsHandler({
  listRuns,
  secret: env.RAG_QUERY_SECRET ?? "",
});
