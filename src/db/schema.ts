import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const documentStatus = pgEnum("document_status", [
  "pending",
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

export type DocumentStatus = (typeof documentStatus.enumValues)[number];
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
