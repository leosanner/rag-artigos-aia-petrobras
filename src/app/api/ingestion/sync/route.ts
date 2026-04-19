import { db } from "@/db/client";
import { env } from "@/env/server";
import { InngestIngestionEventPublisher } from "@/infrastructure/ingestion/inngest";
import { IngestionRunsRepository } from "@/repositories/ingestion-runs-repository";
import { StartIngestionRun } from "@/application/ingestion/start-ingestion-run";

import { createSyncHandler } from "./handler";

export const dynamic = "force-dynamic";

const startRun = new StartIngestionRun({
  runsRepository: new IngestionRunsRepository(db),
  eventPublisher: new InngestIngestionEventPublisher(),
});

export const POST = createSyncHandler({
  startRun,
  secret: env.INGESTION_SYNC_SECRET ?? "",
});
