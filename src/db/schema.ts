import { sql } from "drizzle-orm";
import {
  check,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const documentStatus = pgEnum("document_status", [
  "pending",
  "processed",
  "failed",
]);

export const ingestionRunStatus = pgEnum("ingestion_run_status", [
  "queued",
  "processing",
  "completed",
  "failed",
]);

export const ingestionRunItemStatus = pgEnum("ingestion_run_item_status", [
  "processing",
  "processed",
  "failed",
]);

export const ragIndexingRunStatus = pgEnum("rag_indexing_run_status", [
  "queued",
  "processing",
  "completed",
  "failed",
]);

export const ragIndexingRunItemStatus = pgEnum(
  "rag_indexing_run_item_status",
  ["processing", "processed", "failed"],
);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  driveFileId: text("drive_file_id").notNull().unique(),
  origin: text("origin").notNull().default("google_drive"),
  fileHash: text("file_hash").notNull(),
  pipelineVersion: text("pipeline_version").notNull(),
  status: documentStatus("status").notNull().default("pending"),
  doi: text("doi"),
  authors: text("authors"),
  publicationYear: integer("publication_year"),
  notes: text("notes"),
  rawText: text("raw_text"),
  refinedText: text("refined_text"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const ingestionRuns = pgTable(
  "ingestion_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: ingestionRunStatus("status").notNull().default("queued"),
    maxDocuments: integer("max_documents").notNull(),
    selectedCount: integer("selected_count").notNull().default(0),
    processedCount: integer("processed_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    skippedExistingCount: integer("skipped_existing_count")
      .notNull()
      .default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("ingestion_runs_max_documents_positive", sql`${table.maxDocuments} > 0`),
    check(
      "ingestion_runs_selected_count_non_negative",
      sql`${table.selectedCount} >= 0`,
    ),
    check(
      "ingestion_runs_processed_count_non_negative",
      sql`${table.processedCount} >= 0`,
    ),
    check(
      "ingestion_runs_failed_count_non_negative",
      sql`${table.failedCount} >= 0`,
    ),
    check(
      "ingestion_runs_skipped_existing_count_non_negative",
      sql`${table.skippedExistingCount} >= 0`,
    ),
    uniqueIndex("ingestion_runs_one_active_idx")
      .on(sql`(1)`)
      .where(sql`${table.status} in ('queued', 'processing')`),
  ],
);

export const ingestionRunItems = pgTable(
  "ingestion_run_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => ingestionRuns.id, { onDelete: "cascade" }),
    driveFileId: text("drive_file_id").notNull(),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    status: ingestionRunItemStatus("status").notNull().default("processing"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ingestion_run_items_run_id_idx").on(table.runId),
    index("ingestion_run_items_document_id_idx").on(table.documentId),
    index("ingestion_run_items_drive_file_id_idx").on(table.driveFileId),
  ],
);

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    estimatedTokens: integer("estimated_tokens").notNull(),
    documentPipelineVersion: text("document_pipeline_version").notNull(),
    chunkingVersion: text("chunking_version").notNull(),
    embeddingModel: text("embedding_model").notNull(),
    embeddingDimensions: integer("embedding_dimensions").notNull(),
    embedding: vector("embedding", { dimensions: 3072 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("document_chunks_chunk_index_non_negative", sql`${table.chunkIndex} >= 0`),
    check(
      "document_chunks_content_non_empty",
      sql`length(btrim(${table.content})) > 0`,
    ),
    check(
      "document_chunks_estimated_tokens_positive",
      sql`${table.estimatedTokens} > 0`,
    ),
    check(
      "document_chunks_embedding_dimensions_3072",
      sql`${table.embeddingDimensions} = 3072`,
    ),
    index("document_chunks_document_id_idx").on(table.documentId),
    uniqueIndex("document_chunks_document_config_chunk_idx").on(
      table.documentId,
      table.chunkingVersion,
      table.embeddingModel,
      table.chunkIndex,
    ),
  ],
);

export const ragIndexingRuns = pgTable(
  "rag_indexing_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: ragIndexingRunStatus("status").notNull().default("queued"),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    force: boolean("force").notNull().default(false),
    selectedCount: integer("selected_count").notNull().default(0),
    processedCount: integer("processed_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "rag_indexing_runs_selected_count_non_negative",
      sql`${table.selectedCount} >= 0`,
    ),
    check(
      "rag_indexing_runs_processed_count_non_negative",
      sql`${table.processedCount} >= 0`,
    ),
    check(
      "rag_indexing_runs_failed_count_non_negative",
      sql`${table.failedCount} >= 0`,
    ),
    check(
      "rag_indexing_runs_skipped_count_non_negative",
      sql`${table.skippedCount} >= 0`,
    ),
    index("rag_indexing_runs_document_id_idx").on(table.documentId),
    uniqueIndex("rag_indexing_runs_one_active_idx")
      .on(sql`(1)`)
      .where(sql`${table.status} in ('queued', 'processing')`),
  ],
);

export const ragIndexingRunItems = pgTable(
  "rag_indexing_run_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => ragIndexingRuns.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    status: ragIndexingRunItemStatus("status").notNull().default("processing"),
    chunkCount: integer("chunk_count").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "rag_indexing_run_items_chunk_count_non_negative",
      sql`${table.chunkCount} >= 0`,
    ),
    index("rag_indexing_run_items_run_id_idx").on(table.runId),
    index("rag_indexing_run_items_document_id_idx").on(table.documentId),
  ],
);

export type DocumentStatus = (typeof documentStatus.enumValues)[number];
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type IngestionRunStatus = (typeof ingestionRunStatus.enumValues)[number];
export type IngestionRun = typeof ingestionRuns.$inferSelect;
export type NewIngestionRun = typeof ingestionRuns.$inferInsert;
export type IngestionRunItemStatus =
  (typeof ingestionRunItemStatus.enumValues)[number];
export type IngestionRunItem = typeof ingestionRunItems.$inferSelect;
export type NewIngestionRunItem = typeof ingestionRunItems.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
export type RagIndexingRunStatus =
  (typeof ragIndexingRunStatus.enumValues)[number];
export type RagIndexingRun = typeof ragIndexingRuns.$inferSelect;
export type NewRagIndexingRun = typeof ragIndexingRuns.$inferInsert;
export type RagIndexingRunItemStatus =
  (typeof ragIndexingRunItemStatus.enumValues)[number];
export type RagIndexingRunItem = typeof ragIndexingRunItems.$inferSelect;
export type NewRagIndexingRunItem = typeof ragIndexingRunItems.$inferInsert;
