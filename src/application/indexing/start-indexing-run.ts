import type { IndexingEventPublisher } from "@/application/indexing/ports";
import {
  ActiveIndexingRunConflictError,
  type RagIndexingRunsRepository,
} from "@/repositories/rag-indexing-runs-repository";

export type StartIndexingRunInput = {
  documentId?: string | null;
  force?: boolean;
};

export type StartIndexingRunResult =
  | {
      kind: "queued";
      runId: string;
      status: "queued";
      documentId: string | null;
      force: boolean;
    }
  | { kind: "conflict"; activeRunId: string | null };

type StartIndexingRunsRepository = Pick<
  RagIndexingRunsRepository,
  "createQueuedRun"
>;

export type StartIndexingRunDeps = {
  runsRepository: StartIndexingRunsRepository;
  eventPublisher: IndexingEventPublisher;
};

export class StartIndexingRun {
  private readonly runsRepository: StartIndexingRunsRepository;
  private readonly eventPublisher: IndexingEventPublisher;

  constructor(deps: StartIndexingRunDeps) {
    this.runsRepository = deps.runsRepository;
    this.eventPublisher = deps.eventPublisher;
  }

  async execute(input: StartIndexingRunInput): Promise<StartIndexingRunResult> {
    const force = input.force ?? false;
    const documentId = input.documentId ?? null;

    let run;
    try {
      run = await this.runsRepository.createQueuedRun({
        documentId,
        force,
      });
    } catch (error) {
      if (error instanceof ActiveIndexingRunConflictError) {
        return { kind: "conflict", activeRunId: error.activeRunId };
      }
      throw error;
    }

    await this.eventPublisher.publishIndexingRequested(run.id);

    return {
      kind: "queued",
      runId: run.id,
      status: "queued",
      documentId: run.documentId,
      force: run.force,
    };
  }
}
