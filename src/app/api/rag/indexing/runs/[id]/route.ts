import { GetIndexingRun } from "@/application/indexing/get-indexing-run";
import { db } from "@/db/client";
import { RagIndexingRunsRepository } from "@/repositories/rag-indexing-runs-repository";

import { createIndexingRunDetailHandler } from "./handler";

export const dynamic = "force-dynamic";

const getRun = new GetIndexingRun({
  runsRepository: new RagIndexingRunsRepository(db),
});

export const GET = createIndexingRunDetailHandler({ getRun });
