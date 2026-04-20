import { and, asc, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import {
  ragIndexingRunItems,
  ragIndexingRuns,
  type RagIndexingRun,
  type RagIndexingRunItem,
  type RagIndexingRunStatus,
} from "@/db/schema";
import type { IndexingErrorCode } from "@/domain/indexing/errors";

type DatabaseClient = Pick<
  NodePgDatabase<typeof schema>,
  "select" | "insert" | "update"
>;

const ACTIVE_RUN_STATUSES: RagIndexingRunStatus[] = ["queued", "processing"];

export type CreateQueuedIndexingRunInput = {
  documentId?: string | null;
  force: boolean;
};

export type CompleteIndexingRunCounts = {
  selectedCount: number;
  processedCount: number;
  failedCount: number;
  skippedCount: number;
};

export type CreateIndexingRunItemInput = {
  runId: string;
  documentId: string;
  title: string;
};

export type MarkIndexingRunItemProcessedInput = {
  chunkCount: number;
};

export type MarkIndexingRunItemFailedInput = {
  errorCode: IndexingErrorCode;
};

export type RagIndexingRunWithItems = {
  run: RagIndexingRun;
  items: RagIndexingRunItem[];
};

export class ActiveIndexingRunConflictError extends Error {
  readonly activeRunId: string | null;

  constructor(activeRunId: string | null) {
    super("A RAG indexing run is already active");
    this.name = "ActiveIndexingRunConflictError";
    this.activeRunId = activeRunId;
  }
}

export class RagIndexingRunLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RagIndexingRunLifecycleError";
  }
}

export class RagIndexingRunsRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findActiveRun(): Promise<RagIndexingRun | null> {
    const [run] = await this.db
      .select()
      .from(ragIndexingRuns)
      .where(inArray(ragIndexingRuns.status, ACTIVE_RUN_STATUSES))
      .orderBy(asc(ragIndexingRuns.createdAt))
      .limit(1);

    return run ?? null;
  }

  async createQueuedRun(
    input: CreateQueuedIndexingRunInput,
  ): Promise<RagIndexingRun> {
    try {
      const [run] = await this.db
        .insert(ragIndexingRuns)
        .values({
          status: "queued",
          documentId: input.documentId ?? null,
          force: input.force,
          selectedCount: 0,
          processedCount: 0,
          failedCount: 0,
          skippedCount: 0,
          lastError: null,
        })
        .returning();

      return run;
    } catch (error) {
      if (isUniqueViolation(error)) {
        const activeRun = await this.findActiveRun();
        throw new ActiveIndexingRunConflictError(activeRun?.id ?? null);
      }

      throw error;
    }
  }

  async markProcessing(runId: string): Promise<RagIndexingRun> {
    const [run] = await this.db
      .update(ragIndexingRuns)
      .set({
        status: "processing",
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(ragIndexingRuns.id, runId), eq(ragIndexingRuns.status, "queued")),
      )
      .returning();

    return requireRun(run, `Cannot mark indexing run ${runId} processing`);
  }

  async completeRun(
    runId: string,
    counts: CompleteIndexingRunCounts,
  ): Promise<RagIndexingRun> {
    assertNonNegativeCounts(counts);

    const [run] = await this.db
      .update(ragIndexingRuns)
      .set({
        status: "completed",
        selectedCount: counts.selectedCount,
        processedCount: counts.processedCount,
        failedCount: counts.failedCount,
        skippedCount: counts.skippedCount,
        lastError: null,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(ragIndexingRuns.id, runId), eq(ragIndexingRuns.status, "processing")),
      )
      .returning();

    return requireRun(run, `Cannot complete indexing run ${runId}`);
  }

  async failRun(
    runId: string,
    errorCode: IndexingErrorCode,
  ): Promise<RagIndexingRun> {
    const [run] = await this.db
      .update(ragIndexingRuns)
      .set({
        status: "failed",
        lastError: errorCode,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ragIndexingRuns.id, runId),
          inArray(ragIndexingRuns.status, ACTIVE_RUN_STATUSES),
        ),
      )
      .returning();

    return requireRun(run, `Cannot fail indexing run ${runId}`);
  }

  async createRunItem(
    input: CreateIndexingRunItemInput,
  ): Promise<RagIndexingRunItem> {
    const [item] = await this.db
      .insert(ragIndexingRunItems)
      .values({
        runId: input.runId,
        documentId: input.documentId,
        title: input.title,
        status: "processing",
        chunkCount: 0,
        lastError: null,
      })
      .returning();

    return item;
  }

  async markRunItemProcessed(
    itemId: string,
    input: MarkIndexingRunItemProcessedInput,
  ): Promise<RagIndexingRunItem> {
    assertNonNegativeInteger(input.chunkCount, "chunkCount");

    const [item] = await this.db
      .update(ragIndexingRunItems)
      .set({
        status: "processed",
        chunkCount: input.chunkCount,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ragIndexingRunItems.id, itemId),
          eq(ragIndexingRunItems.status, "processing"),
        ),
      )
      .returning();

    return requireRunItem(item, `Cannot mark indexing run item ${itemId} processed`);
  }

  async markRunItemFailed(
    itemId: string,
    input: MarkIndexingRunItemFailedInput,
  ): Promise<RagIndexingRunItem> {
    const [item] = await this.db
      .update(ragIndexingRunItems)
      .set({
        status: "failed",
        lastError: input.errorCode,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ragIndexingRunItems.id, itemId),
          eq(ragIndexingRunItems.status, "processing"),
        ),
      )
      .returning();

    return requireRunItem(item, `Cannot mark indexing run item ${itemId} failed`);
  }

  async getRunWithItems(
    runId: string,
  ): Promise<RagIndexingRunWithItems | null> {
    const [run] = await this.db
      .select()
      .from(ragIndexingRuns)
      .where(eq(ragIndexingRuns.id, runId))
      .limit(1);

    if (!run) {
      return null;
    }

    const items = await this.db
      .select()
      .from(ragIndexingRunItems)
      .where(eq(ragIndexingRunItems.runId, runId))
      .orderBy(asc(ragIndexingRunItems.createdAt));

    return { run, items };
  }
}

function requireRun(
  run: RagIndexingRun | undefined,
  message: string,
): RagIndexingRun {
  if (!run) {
    throw new RagIndexingRunLifecycleError(message);
  }

  return run;
}

function requireRunItem(
  item: RagIndexingRunItem | undefined,
  message: string,
): RagIndexingRunItem {
  if (!item) {
    throw new RagIndexingRunLifecycleError(message);
  }

  return item;
}

function assertNonNegativeCounts(counts: CompleteIndexingRunCounts): void {
  for (const [fieldName, value] of Object.entries(counts)) {
    assertNonNegativeInteger(value, fieldName);
  }
}

function assertNonNegativeInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RagIndexingRunLifecycleError(
      `${fieldName} must be a non-negative integer`,
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
