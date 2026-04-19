import { toSafeErrorCode } from "@/domain/documents/errors";
import { pipelineVersion as DEFAULT_PIPELINE_VERSION } from "@/domain/documents/pipeline-version";
import type { DocumentsRepository } from "@/repositories/documents-repository";
import type { IngestionRunsRepository } from "@/repositories/ingestion-runs-repository";

import type {
  DriveFileCandidate,
  DriveFileSource,
  FileHasher,
  PdfExtractor,
  ProcessIngestionRunHandler,
} from "./ports";

export type ProcessIngestionRunDeps = {
  driveSource: DriveFileSource;
  pdfExtractor: PdfExtractor;
  refiner: (rawText: string) => string;
  hasher: FileHasher;
  documentsRepository: DocumentsRepository;
  runsRepository: IngestionRunsRepository;
  pipelineVersion?: string;
  maxDocuments?: number;
};

const DEFAULT_MAX_DOCUMENTS = 3;

export class ProcessIngestionRun implements ProcessIngestionRunHandler {
  private readonly driveSource: DriveFileSource;
  private readonly pdfExtractor: PdfExtractor;
  private readonly refiner: (rawText: string) => string;
  private readonly hasher: FileHasher;
  private readonly documentsRepository: DocumentsRepository;
  private readonly runsRepository: IngestionRunsRepository;
  private readonly pipelineVersion: string;
  private readonly defaultMaxDocuments: number;

  constructor(deps: ProcessIngestionRunDeps) {
    this.driveSource = deps.driveSource;
    this.pdfExtractor = deps.pdfExtractor;
    this.refiner = deps.refiner;
    this.hasher = deps.hasher;
    this.documentsRepository = deps.documentsRepository;
    this.runsRepository = deps.runsRepository;
    this.pipelineVersion = deps.pipelineVersion ?? DEFAULT_PIPELINE_VERSION;
    this.defaultMaxDocuments = deps.maxDocuments ?? DEFAULT_MAX_DOCUMENTS;
  }

  async execute(runId: string): Promise<void> {
    const run = await this.runsRepository.markProcessing(runId);
    const maxDocuments = run.maxDocuments ?? this.defaultMaxDocuments;

    let candidates: DriveFileCandidate[];
    try {
      candidates = await this.driveSource.listFiles();
    } catch {
      await this.runsRepository.failRun(runId, "drive_listing_failed");
      return;
    }

    const pdfCandidates = candidates.filter(isPdfCandidate);
    const { selected, skippedExistingCount } =
      await this.partitionCandidates(pdfCandidates, maxDocuments);

    let processedCount = 0;
    let failedCount = 0;

    for (const candidate of selected) {
      const item = await this.runsRepository.createRunItem({
        runId,
        driveFileId: candidate.driveFileId,
        title: candidate.name,
      });

      let bytes: Uint8Array;
      try {
        bytes = await this.driveSource.downloadFile(candidate.driveFileId);
      } catch {
        await this.runsRepository.markRunItemFailed(item.id, {
          errorCode: "drive_download_failed",
        });
        failedCount += 1;
        continue;
      }

      let fileHash: string;
      try {
        fileHash = this.hasher.hash(bytes);
      } catch (error) {
        await this.runsRepository.markRunItemFailed(item.id, {
          errorCode: toSafeErrorCode(error),
        });
        failedCount += 1;
        continue;
      }

      let document: Awaited<
        ReturnType<DocumentsRepository["createPendingDocument"]>
      >;
      try {
        document = await this.documentsRepository.createPendingDocument({
          title: candidate.name,
          driveFileId: candidate.driveFileId,
          fileHash,
          pipelineVersion: this.pipelineVersion,
        });
      } catch (error) {
        await this.runsRepository.markRunItemFailed(item.id, {
          errorCode: toSafeErrorCode(error),
        });
        failedCount += 1;
        continue;
      }

      let rawText: string;
      try {
        rawText = await this.pdfExtractor.extract(bytes);
      } catch (error) {
        const code = toSafeErrorCode(error);
        await this.documentsRepository.markFailed(document.id, code);
        await this.runsRepository.markRunItemFailed(item.id, {
          errorCode: code,
          documentId: document.id,
        });
        failedCount += 1;
        continue;
      }

      try {
        await this.documentsRepository.saveRawText(document.id, rawText);
      } catch (error) {
        const code = toSafeErrorCode(error);
        await this.documentsRepository.markFailed(document.id, code);
        await this.runsRepository.markRunItemFailed(item.id, {
          errorCode: code,
          documentId: document.id,
        });
        failedCount += 1;
        continue;
      }

      let refined: string;
      try {
        refined = this.refiner(rawText);
      } catch (error) {
        const code = toSafeErrorCode(error);
        await this.documentsRepository.markFailed(document.id, code);
        await this.runsRepository.markRunItemFailed(item.id, {
          errorCode: code,
          documentId: document.id,
        });
        failedCount += 1;
        continue;
      }

      try {
        await this.documentsRepository.markProcessed(document.id, refined);
      } catch (error) {
        await this.runsRepository.markRunItemFailed(item.id, {
          errorCode: toSafeErrorCode(error),
          documentId: document.id,
        });
        failedCount += 1;
        continue;
      }

      try {
        await this.runsRepository.markRunItemProcessed(item.id, document.id);
      } catch (error) {
        await this.runsRepository.markRunItemFailed(item.id, {
          errorCode: toSafeErrorCode(error),
          documentId: document.id,
        });
        failedCount += 1;
        continue;
      }

      processedCount += 1;
    }

    await this.runsRepository.completeRun(runId, {
      selectedCount: selected.length,
      processedCount,
      failedCount,
      skippedExistingCount,
    });
  }

  private async partitionCandidates(
    candidates: DriveFileCandidate[],
    maxDocuments: number,
  ): Promise<{
    selected: DriveFileCandidate[];
    skippedExistingCount: number;
  }> {
    const selected: DriveFileCandidate[] = [];
    let skippedExistingCount = 0;

    for (const candidate of candidates) {
      const exists = await this.documentsRepository.existsByDriveFileId(
        candidate.driveFileId,
      );
      if (exists) {
        skippedExistingCount += 1;
        continue;
      }
      if (selected.length < maxDocuments) {
        selected.push(candidate);
      }
    }

    return { selected, skippedExistingCount };
  }
}

function isPdfCandidate(candidate: DriveFileCandidate): boolean {
  return (
    candidate.mimeType === "application/pdf" ||
    candidate.name.toLowerCase().endsWith(".pdf")
  );
}
