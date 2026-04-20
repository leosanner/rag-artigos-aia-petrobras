import { StartIndexingRun } from "@/application/indexing/start-indexing-run";
import { db } from "@/db/client";
import { env } from "@/env/server";
import { InngestIndexingEventPublisher } from "@/infrastructure/indexing/inngest";
import { RagIndexingRunsRepository } from "@/repositories/rag-indexing-runs-repository";

import { createIndexingRunStartHandler } from "./handler";

export const dynamic = "force-dynamic";

const startRun = new StartIndexingRun({
  runsRepository: new RagIndexingRunsRepository(db),
  eventPublisher: new InngestIndexingEventPublisher(),
});

export const POST = createIndexingRunStartHandler({
  startRun,
  secret: env.INGESTION_SYNC_SECRET ?? "",
});
