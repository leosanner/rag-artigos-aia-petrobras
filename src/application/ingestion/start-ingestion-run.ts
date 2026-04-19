import type { IngestionEventPublisher } from "@/application/ingestion/ports";
import {
  ActiveIngestionRunConflictError,
  type IngestionRunsRepository,
} from "@/repositories/ingestion-runs-repository";

export type StartIngestionRunResult =
  | { kind: "queued"; runId: string; maxDocuments: number }
  | { kind: "conflict"; activeRunId: string | null };

export type StartIngestionRunDeps = {
  runsRepository: IngestionRunsRepository;
  eventPublisher: IngestionEventPublisher;
  maxDocuments?: number;
};

const DEFAULT_MAX_DOCUMENTS = 3;

export class StartIngestionRun {
  private readonly runsRepository: IngestionRunsRepository;
  private readonly eventPublisher: IngestionEventPublisher;
  private readonly maxDocuments: number;

  constructor(deps: StartIngestionRunDeps) {
    this.runsRepository = deps.runsRepository;
    this.eventPublisher = deps.eventPublisher;
    this.maxDocuments = deps.maxDocuments ?? DEFAULT_MAX_DOCUMENTS;
  }

  async execute(): Promise<StartIngestionRunResult> {
    let run;
    try {
      run = await this.runsRepository.createQueuedRun({
        maxDocuments: this.maxDocuments,
      });
    } catch (error) {
      if (error instanceof ActiveIngestionRunConflictError) {
        return { kind: "conflict", activeRunId: error.activeRunId };
      }
      throw error;
    }

    await this.eventPublisher.publishSyncRequested(run.id);

    return {
      kind: "queued",
      runId: run.id,
      maxDocuments: this.maxDocuments,
    };
  }
}
