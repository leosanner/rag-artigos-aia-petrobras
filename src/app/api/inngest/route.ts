import { serve } from "inngest/next";

import { ProcessIngestionRun } from "@/application/ingestion/process-ingestion-run";
import { db } from "@/db/client";
import { refineText } from "@/domain/text/deterministic-refiner";
import { createGoogleDriveFileSourceFromEnv } from "@/infrastructure/drive/google-drive-file-source";
import { Sha256FileHasher } from "@/infrastructure/crypto/sha256-file-hasher";
import {
  createProcessIngestionRunFunction,
  inngest,
} from "@/infrastructure/ingestion/inngest";
import { UnpdfPdfExtractor } from "@/infrastructure/pdf/unpdf-pdf-extractor";
import { DocumentsRepository } from "@/repositories/documents-repository";
import { IngestionRunsRepository } from "@/repositories/ingestion-runs-repository";

const processIngestionRunHandler = new ProcessIngestionRun({
  driveSource: createGoogleDriveFileSourceFromEnv(),
  pdfExtractor: new UnpdfPdfExtractor(),
  refiner: refineText,
  hasher: new Sha256FileHasher(),
  documentsRepository: new DocumentsRepository(db),
  runsRepository: new IngestionRunsRepository(db),
});

const processIngestionRun = createProcessIngestionRunFunction(
  processIngestionRunHandler,
);

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processIngestionRun as Parameters<typeof serve>[0]["functions"][number]],
});
