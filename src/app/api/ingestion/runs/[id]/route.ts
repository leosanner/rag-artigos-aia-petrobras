import { db } from "@/db/client";
import { GetIngestionRun } from "@/application/ingestion/get-ingestion-run";
import { IngestionRunsRepository } from "@/repositories/ingestion-runs-repository";

import { createRunDetailHandler } from "./handler";

export const dynamic = "force-dynamic";

const getRun = new GetIngestionRun({
  runsRepository: new IngestionRunsRepository(db),
});

export const GET = createRunDetailHandler({ getRun });
