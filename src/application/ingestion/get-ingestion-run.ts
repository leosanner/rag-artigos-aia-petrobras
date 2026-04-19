import type {
  IngestionRun,
  IngestionRunItem,
  IngestionRunItemStatus,
  IngestionRunStatus,
} from "@/db/schema";
import type {
  IngestionErrorCode,
} from "@/domain/documents/errors";
import type { IngestionRunsRepository } from "@/repositories/ingestion-runs-repository";

const INGESTION_ERROR_CODES: readonly IngestionErrorCode[] = [
  "drive_download_failed",
  "raw_text_empty",
  "extraction_failed",
  "refined_text_empty",
  "refinement_failed",
  "unknown_error",
];

export type IngestionRunItemDto = {
  id: string;
  driveFileId: string;
  title: string;
  status: IngestionRunItemStatus;
  lastError: IngestionErrorCode | null;
  documentId: string | null;
};

export type IngestionRunDetailDto = {
  id: string;
  status: IngestionRunStatus;
  maxDocuments: number;
  selectedCount: number;
  processedCount: number;
  failedCount: number;
  skippedExistingCount: number;
  lastError: IngestionErrorCode | null;
  items: IngestionRunItemDto[];
};

export type GetIngestionRunDeps = {
  runsRepository: IngestionRunsRepository;
};

export class GetIngestionRun {
  private readonly runsRepository: IngestionRunsRepository;

  constructor(deps: GetIngestionRunDeps) {
    this.runsRepository = deps.runsRepository;
  }

  async execute(runId: string): Promise<IngestionRunDetailDto | null> {
    const persisted = await this.runsRepository.getRunWithItems(runId);

    if (!persisted) {
      return null;
    }

    return toRunDetailDto(persisted.run, persisted.items);
  }
}

function toRunDetailDto(
  run: IngestionRun,
  items: IngestionRunItem[],
): IngestionRunDetailDto {
  return {
    id: run.id,
    status: run.status,
    maxDocuments: run.maxDocuments,
    selectedCount: run.selectedCount,
    processedCount: run.processedCount,
    failedCount: run.failedCount,
    skippedExistingCount: run.skippedExistingCount,
    lastError: toSafeStoredErrorCode(run.lastError),
    items: items.map((item) => ({
      id: item.id,
      driveFileId: item.driveFileId,
      title: item.title,
      status: item.status,
      lastError: toSafeStoredErrorCode(item.lastError),
      documentId: item.documentId ?? null,
    })),
  };
}

function toSafeStoredErrorCode(value: string | null): IngestionErrorCode | null {
  if (value === null) {
    return null;
  }

  return (INGESTION_ERROR_CODES as readonly string[]).includes(value)
    ? (value as IngestionErrorCode)
    : "unknown_error";
}
