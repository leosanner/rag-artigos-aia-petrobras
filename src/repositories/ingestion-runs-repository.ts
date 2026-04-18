import { and, asc, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import {
  ingestionRunItems,
  ingestionRuns,
  type IngestionRun,
  type IngestionRunItem,
  type IngestionRunStatus,
} from "@/db/schema";
import type { IngestionErrorCode } from "@/domain/documents/errors";

type DatabaseClient = Pick<
  NodePgDatabase<typeof schema>,
  "select" | "insert" | "update"
>;

const ACTIVE_RUN_STATUSES: IngestionRunStatus[] = ["queued", "processing"];

export type CreateQueuedRunInput = {
  maxDocuments: number;
};

export type CompleteRunCounts = {
  selectedCount: number;
  processedCount: number;
  failedCount: number;
  skippedExistingCount: number;
};

export type CreateRunItemInput = {
  runId: string;
  driveFileId: string;
  title: string;
};

export type MarkRunItemFailedInput = {
  errorCode: IngestionErrorCode;
  documentId?: string;
};

export type IngestionRunWithItems = {
  run: IngestionRun;
  items: IngestionRunItem[];
};

export class ActiveIngestionRunConflictError extends Error {
  readonly activeRunId: string | null;

  constructor(activeRunId: string | null) {
    super("An ingestion run is already active");
    this.name = "ActiveIngestionRunConflictError";
    this.activeRunId = activeRunId;
  }
}

export class IngestionRunLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestionRunLifecycleError";
  }
}

export class IngestionRunsRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findActiveRun(): Promise<IngestionRun | null> {
    const [run] = await this.db
      .select()
      .from(ingestionRuns)
      .where(inArray(ingestionRuns.status, ACTIVE_RUN_STATUSES))
      .orderBy(asc(ingestionRuns.createdAt))
      .limit(1);

    return run ?? null;
  }

  async createQueuedRun(input: CreateQueuedRunInput): Promise<IngestionRun> {
    assertPositiveInteger(input.maxDocuments, "maxDocuments");

    try {
      const [run] = await this.db
        .insert(ingestionRuns)
        .values({
          status: "queued",
          maxDocuments: input.maxDocuments,
          selectedCount: 0,
          processedCount: 0,
          failedCount: 0,
          skippedExistingCount: 0,
          lastError: null,
        })
        .returning();

      return run;
    } catch (error) {
      if (isUniqueViolation(error)) {
        const activeRun = await this.findActiveRun();
        throw new ActiveIngestionRunConflictError(activeRun?.id ?? null);
      }

      throw error;
    }
  }

  async markProcessing(runId: string): Promise<IngestionRun> {
    const [run] = await this.db
      .update(ingestionRuns)
      .set({
        status: "processing",
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(ingestionRuns.id, runId), eq(ingestionRuns.status, "queued")))
      .returning();

    return requireRun(run, `Cannot mark ingestion run ${runId} processing`);
  }

  async completeRun(
    runId: string,
    counts: CompleteRunCounts,
  ): Promise<IngestionRun> {
    assertNonNegativeCounts(counts);

    const [run] = await this.db
      .update(ingestionRuns)
      .set({
        status: "completed",
        selectedCount: counts.selectedCount,
        processedCount: counts.processedCount,
        failedCount: counts.failedCount,
        skippedExistingCount: counts.skippedExistingCount,
        lastError: null,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(ingestionRuns.id, runId), eq(ingestionRuns.status, "processing")),
      )
      .returning();

    return requireRun(run, `Cannot complete ingestion run ${runId}`);
  }

  async failRun(
    runId: string,
    errorCode: IngestionErrorCode,
  ): Promise<IngestionRun> {
    const [run] = await this.db
      .update(ingestionRuns)
      .set({
        status: "failed",
        lastError: errorCode,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ingestionRuns.id, runId),
          inArray(ingestionRuns.status, ACTIVE_RUN_STATUSES),
        ),
      )
      .returning();

    return requireRun(run, `Cannot fail ingestion run ${runId}`);
  }

  async createRunItem(input: CreateRunItemInput): Promise<IngestionRunItem> {
    const [item] = await this.db
      .insert(ingestionRunItems)
      .values({
        runId: input.runId,
        driveFileId: input.driveFileId,
        title: input.title,
        status: "processing",
        documentId: null,
        lastError: null,
      })
      .returning();

    return item;
  }

  async markRunItemProcessed(
    itemId: string,
    documentId: string,
  ): Promise<IngestionRunItem> {
    const [item] = await this.db
      .update(ingestionRunItems)
      .set({
        status: "processed",
        documentId,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ingestionRunItems.id, itemId),
          eq(ingestionRunItems.status, "processing"),
        ),
      )
      .returning();

    return requireRunItem(item, `Cannot mark ingestion run item ${itemId} processed`);
  }

  async markRunItemFailed(
    itemId: string,
    input: MarkRunItemFailedInput,
  ): Promise<IngestionRunItem> {
    const [item] = await this.db
      .update(ingestionRunItems)
      .set({
        status: "failed",
        documentId: input.documentId ?? null,
        lastError: input.errorCode,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ingestionRunItems.id, itemId),
          eq(ingestionRunItems.status, "processing"),
        ),
      )
      .returning();

    return requireRunItem(item, `Cannot mark ingestion run item ${itemId} failed`);
  }

  async getRunWithItems(runId: string): Promise<IngestionRunWithItems | null> {
    const [run] = await this.db
      .select()
      .from(ingestionRuns)
      .where(eq(ingestionRuns.id, runId))
      .limit(1);

    if (!run) {
      return null;
    }

    const items = await this.db
      .select()
      .from(ingestionRunItems)
      .where(eq(ingestionRunItems.runId, runId))
      .orderBy(asc(ingestionRunItems.createdAt));

    return { run, items };
  }
}

function requireRun(run: IngestionRun | undefined, message: string): IngestionRun {
  if (!run) {
    throw new IngestionRunLifecycleError(message);
  }

  return run;
}

function requireRunItem(
  item: IngestionRunItem | undefined,
  message: string,
): IngestionRunItem {
  if (!item) {
    throw new IngestionRunLifecycleError(message);
  }

  return item;
}

function assertPositiveInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new IngestionRunLifecycleError(`${fieldName} must be a positive integer`);
  }
}

function assertNonNegativeCounts(counts: CompleteRunCounts): void {
  for (const [fieldName, value] of Object.entries(counts)) {
    if (!Number.isInteger(value) || value < 0) {
      throw new IngestionRunLifecycleError(
        `${fieldName} must be a non-negative integer`,
      );
    }
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
