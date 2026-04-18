import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
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
