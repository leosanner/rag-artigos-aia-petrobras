import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import { documents, type Document } from "@/db/schema";
import type { IngestionErrorCode } from "@/domain/documents/errors";
import { transitionStatus } from "@/domain/documents/status";

type DatabaseClient = Pick<
  NodePgDatabase<typeof schema>,
  "select" | "insert" | "update"
>;

export type CreatePendingDocumentInput = {
  title: string;
  driveFileId: string;
  fileHash: string;
  pipelineVersion: string;
};

export class DocumentLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentLifecycleError";
  }
}

export class DocumentsRepository {
  constructor(private readonly db: DatabaseClient) {}

  async existsByDriveFileId(driveFileId: string): Promise<boolean> {
    const [existing] = await this.db
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.driveFileId, driveFileId))
      .limit(1);

    return existing !== undefined;
  }

  async createPendingDocument(
    input: CreatePendingDocumentInput,
  ): Promise<Document> {
    const [document] = await this.db
      .insert(documents)
      .values({
        title: input.title,
        driveFileId: input.driveFileId,
        fileHash: input.fileHash,
        pipelineVersion: input.pipelineVersion,
        status: "pending",
        origin: "google_drive",
        doi: null,
        authors: null,
        publicationYear: null,
        notes: null,
        rawText: null,
        refinedText: null,
        lastError: null,
      })
      .returning();

    return document;
  }

  async saveRawText(documentId: string, rawText: string): Promise<Document> {
    assertNonEmptyText(rawText, "raw_text");

    const [document] = await this.db
      .update(documents)
      .set({
        rawText,
        updatedAt: new Date(),
      })
      .where(and(eq(documents.id, documentId), eq(documents.status, "pending")))
      .returning();

    if (!document) {
      throw new DocumentLifecycleError(
        `Cannot save raw_text for non-pending document ${documentId}`,
      );
    }

    return document;
  }

  async markProcessed(
    documentId: string,
    refinedText: string,
  ): Promise<Document> {
    assertNonEmptyText(refinedText, "refined_text");

    const [document] = await this.db
      .update(documents)
      .set({
        status: transitionStatus("pending", "processed"),
        refinedText,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documents.id, documentId),
          eq(documents.status, "pending"),
          isNotNull(documents.rawText),
          sql`length(btrim(${documents.rawText})) > 0`,
        ),
      )
      .returning();

    if (!document) {
      throw new DocumentLifecycleError(
        `Cannot mark document ${documentId} processed before raw_text is persisted`,
      );
    }

    return document;
  }

  async markFailed(
    documentId: string,
    errorCode: IngestionErrorCode,
  ): Promise<Document> {
    const [document] = await this.db
      .update(documents)
      .set({
        status: transitionStatus("pending", "failed"),
        lastError: errorCode,
        updatedAt: new Date(),
      })
      .where(and(eq(documents.id, documentId), eq(documents.status, "pending")))
      .returning();

    if (!document) {
      throw new DocumentLifecycleError(
        `Cannot mark non-pending document ${documentId} failed`,
      );
    }

    return document;
  }
}

function assertNonEmptyText(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new DocumentLifecycleError(`${fieldName} must be non-empty`);
  }
}
