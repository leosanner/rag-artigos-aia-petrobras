import { serve } from "inngest/next";

import type { ProcessIngestionRunHandler } from "@/application/ingestion/ports";
import { IngestionError } from "@/domain/documents/errors";
import {
  createProcessIngestionRunFunction,
  inngest,
} from "@/infrastructure/ingestion/inngest";

const placeholderProcessIngestionRunHandler: ProcessIngestionRunHandler = {
  async execute(runId: string): Promise<void> {
    throw new IngestionError(
      "unknown_error",
      `ProcessIngestionRun is not wired yet (runId=${runId}); will be delivered in F-01 Block 05`,
    );
  },
};

const processIngestionRun = createProcessIngestionRunFunction(
  placeholderProcessIngestionRunHandler,
);

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processIngestionRun as Parameters<typeof serve>[0]["functions"][number]],
});
