import type {
  RagIndexingRun,
  RagIndexingRunItem,
  RagIndexingRunItemStatus,
  RagIndexingRunStatus,
} from "@/db/schema";
import type { IndexingErrorCode } from "@/domain/indexing/errors";
import type { RagIndexingRunsRepository } from "@/repositories/rag-indexing-runs-repository";

const INDEXING_ERROR_CODES: readonly IndexingErrorCode[] = [
  "document_not_indexable",
  "refined_text_empty",
  "chunking_failed",
  "embedding_failed",
  "embedding_dimensions_mismatch",
  "persistence_failed",
  "unknown_error",
];

export type IndexingRunItemDto = {
  id: string;
  documentId: string | null;
  title: string;
  status: RagIndexingRunItemStatus;
  chunkCount: number;
  lastError: IndexingErrorCode | null;
};

export type IndexingRunDetailDto = {
  id: string;
  status: RagIndexingRunStatus;
  documentId: string | null;
  force: boolean;
  selectedCount: number;
  processedCount: number;
  failedCount: number;
  skippedCount: number;
  lastError: IndexingErrorCode | null;
  items: IndexingRunItemDto[];
};

type GetIndexingRunRepository = Pick<
  RagIndexingRunsRepository,
  "getRunWithItems"
>;

export type GetIndexingRunDeps = {
  runsRepository: GetIndexingRunRepository;
};

export class GetIndexingRun {
  private readonly runsRepository: GetIndexingRunRepository;

  constructor(deps: GetIndexingRunDeps) {
    this.runsRepository = deps.runsRepository;
  }

  async execute(runId: string): Promise<IndexingRunDetailDto | null> {
    const persisted = await this.runsRepository.getRunWithItems(runId);

    if (!persisted) {
      return null;
    }

    return toRunDetailDto(persisted.run, persisted.items);
  }
}

function toRunDetailDto(
  run: RagIndexingRun,
  items: RagIndexingRunItem[],
): IndexingRunDetailDto {
  return {
    id: run.id,
    status: run.status,
    documentId: run.documentId ?? null,
    force: run.force,
    selectedCount: run.selectedCount,
    processedCount: run.processedCount,
    failedCount: run.failedCount,
    skippedCount: run.skippedCount,
    lastError: toSafeStoredErrorCode(run.lastError),
    items: items.map((item) => ({
      id: item.id,
      documentId: item.documentId ?? null,
      title: item.title,
      status: item.status,
      chunkCount: item.chunkCount,
      lastError: toSafeStoredErrorCode(item.lastError),
    })),
  };
}

function toSafeStoredErrorCode(value: string | null): IndexingErrorCode | null {
  if (value === null) {
    return null;
  }

  return (INDEXING_ERROR_CODES as readonly string[]).includes(value)
    ? (value as IndexingErrorCode)
    : "unknown_error";
}
