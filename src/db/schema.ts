import { desc, sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
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

export const ragQueryRunStatus = pgEnum("rag_query_run_status", [
  "answered",
  "answered_no_evidence",
  "generation_failed",
  "generation_unavailable",
]);

export const ragQueryRunErrorCode = pgEnum("rag_query_run_error_code", [
  "generation_failed",
  "generation_unavailable",
]);

export const ragConversationMessageRole = pgEnum(
  "rag_conversation_message_role",
  ["user", "assistant"],
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

export const ragQueryRuns = pgTable(
  "rag_query_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    question: text("question").notNull(),
    answer: text("answer"),
    mode: text("mode").$type<"global">().notNull(),
    status: ragQueryRunStatus("status").notNull(),
    errorCode: ragQueryRunErrorCode("error_code"),
    topK: integer("top_k").notNull(),
    retrievalStrategy: text("retrieval_strategy")
      .$type<"standard" | "explore">()
      .notNull(),
    candidateTopK: integer("candidate_top_k").notNull(),
    promptVersion: text("prompt_version").notNull(),
    generationModel: text("generation_model").notNull(),
    embeddingModel: text("embedding_model").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    embeddingInputTokens: integer("embedding_input_tokens").notNull(),
    embeddingCostUsd: doublePrecision("embedding_cost_usd").notNull(),
    generationInputTokens: integer("generation_input_tokens"),
    generationOutputTokens: integer("generation_output_tokens"),
    generationTotalTokens: integer("generation_total_tokens"),
    generationCostUsd: doublePrecision("generation_cost_usd"),
    totalCostUsd: doublePrecision("total_cost_usd").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "rag_query_runs_question_non_empty",
      sql`length(btrim(${table.question})) > 0`,
    ),
    check(
      "rag_query_runs_answer_non_empty_when_present",
      sql`${table.answer} is null or length(btrim(${table.answer})) > 0`,
    ),
    check("rag_query_runs_mode_global", sql`${table.mode} = 'global'`),
    check("rag_query_runs_top_k_positive", sql`${table.topK} > 0`),
    check(
      "rag_query_runs_retrieval_strategy_valid",
      sql`${table.retrievalStrategy} in ('standard', 'explore')`,
    ),
    check(
      "rag_query_runs_candidate_top_k_positive",
      sql`${table.candidateTopK} > 0`,
    ),
    check(
      "rag_query_runs_latency_ms_non_negative",
      sql`${table.latencyMs} >= 0`,
    ),
    check(
      "rag_query_runs_embedding_input_tokens_non_negative",
      sql`${table.embeddingInputTokens} >= 0`,
    ),
    check(
      "rag_query_runs_embedding_cost_usd_non_negative",
      sql`${table.embeddingCostUsd} >= 0`,
    ),
    check(
      "rag_query_runs_generation_input_tokens_non_negative",
      sql`${table.generationInputTokens} is null or ${table.generationInputTokens} >= 0`,
    ),
    check(
      "rag_query_runs_generation_output_tokens_non_negative",
      sql`${table.generationOutputTokens} is null or ${table.generationOutputTokens} >= 0`,
    ),
    check(
      "rag_query_runs_generation_total_tokens_non_negative",
      sql`${table.generationTotalTokens} is null or ${table.generationTotalTokens} >= 0`,
    ),
    check(
      "rag_query_runs_generation_cost_usd_non_negative",
      sql`${table.generationCostUsd} is null or ${table.generationCostUsd} >= 0`,
    ),
    check(
      "rag_query_runs_total_cost_usd_non_negative",
      sql`${table.totalCostUsd} >= 0`,
    ),
    check(
      "rag_query_runs_generation_metrics_all_or_none",
      sql`
        (
          ${table.generationInputTokens} is null and
          ${table.generationOutputTokens} is null and
          ${table.generationTotalTokens} is null and
          ${table.generationCostUsd} is null
        ) or (
          ${table.generationInputTokens} is not null and
          ${table.generationOutputTokens} is not null and
          ${table.generationTotalTokens} is not null and
          ${table.generationCostUsd} is not null
        )
      `,
    ),
    check(
      "rag_query_runs_error_code_matches_status",
      sql`
        (
          ${table.status} in ('answered', 'answered_no_evidence') and
          ${table.errorCode} is null
        ) or (
          ${table.status} = 'generation_failed' and
          ${table.errorCode} = 'generation_failed'
        ) or (
          ${table.status} = 'generation_unavailable' and
          ${table.errorCode} = 'generation_unavailable'
        )
      `,
    ),
    index("rag_query_runs_created_at_idx").on(table.createdAt),
  ],
);

export const ragQueryRunSources = pgTable(
  "rag_query_run_sources",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => ragQueryRuns.id, { onDelete: "cascade" }),
    sourceNumber: integer("source_number").notNull(),
    chunkId: uuid("chunk_id").notNull(),
    documentId: uuid("document_id").notNull(),
    documentTitle: text("document_title").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    excerpt: text("excerpt").notNull(),
    score: doublePrecision("score").notNull(),
    documentPipelineVersion: text("document_pipeline_version").notNull(),
    chunkingVersion: text("chunking_version").notNull(),
    embeddingModel: text("embedding_model").notNull(),
    citedInAnswer: boolean("cited_in_answer").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.runId, table.sourceNumber],
      name: "rag_query_run_sources_pk",
    }),
    check(
      "rag_query_run_sources_source_number_positive",
      sql`${table.sourceNumber} > 0`,
    ),
    check(
      "rag_query_run_sources_chunk_index_non_negative",
      sql`${table.chunkIndex} >= 0`,
    ),
    check(
      "rag_query_run_sources_document_title_non_empty",
      sql`length(btrim(${table.documentTitle})) > 0`,
    ),
    check(
      "rag_query_run_sources_excerpt_non_empty",
      sql`length(btrim(${table.excerpt})) > 0`,
    ),
    index("rag_query_run_sources_run_id_idx").on(table.runId),
  ],
);

export const ragQueryRunRelatedTerms = pgTable(
  "rag_query_run_related_terms",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => ragQueryRuns.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    term: text("term").notNull(),
    ngramSize: integer("ngram_size").notNull(),
    frequency: integer("frequency").notNull(),
    sourceCoverageCount: integer("source_coverage_count").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.runId, table.rank],
      name: "rag_query_run_related_terms_pk",
    }),
    check("rag_query_run_related_terms_rank_positive", sql`${table.rank} > 0`),
    check(
      "rag_query_run_related_terms_rank_max_eight",
      sql`${table.rank} <= 8`,
    ),
    check(
      "rag_query_run_related_terms_term_non_empty",
      sql`length(btrim(${table.term})) > 0`,
    ),
    check(
      "rag_query_run_related_terms_ngram_size_positive",
      sql`${table.ngramSize} > 0`,
    ),
    check(
      "rag_query_run_related_terms_frequency_positive",
      sql`${table.frequency} > 0`,
    ),
    check(
      "rag_query_run_related_terms_source_coverage_count_non_negative",
      sql`${table.sourceCoverageCount} >= 0`,
    ),
    index("rag_query_run_related_terms_run_id_idx").on(table.runId),
  ],
);

export const ragConversations = pgTable(
  "rag_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "rag_conversations_title_non_empty",
      sql`${table.title} is null or length(btrim(${table.title})) > 0`,
    ),
    index("rag_conversations_last_message_at_idx").on(
      desc(table.lastMessageAt),
    ),
  ],
);

export const ragConversationMessages = pgTable(
  "rag_conversation_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => ragConversations.id, { onDelete: "cascade" }),
    role: ragConversationMessageRole("role").notNull(),
    content: text("content").notNull(),
    traceId: uuid("trace_id").references(() => ragQueryRuns.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "rag_conversation_messages_content_non_empty",
      sql`length(btrim(${table.content})) > 0`,
    ),
    check(
      "rag_conversation_messages_assistant_requires_trace",
      sql`${table.role} <> 'assistant' or ${table.traceId} is not null`,
    ),
    check(
      "rag_conversation_messages_user_has_no_trace",
      sql`${table.role} <> 'user' or ${table.traceId} is null`,
    ),
    index("rag_conversation_messages_conversation_created_at_idx").on(
      table.conversationId,
      table.createdAt,
      table.id,
    ),
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
export type RagQueryRunStatus = (typeof ragQueryRunStatus.enumValues)[number];
export type RagQueryRunErrorCode =
  (typeof ragQueryRunErrorCode.enumValues)[number];
export type RagQueryRun = typeof ragQueryRuns.$inferSelect;
export type NewRagQueryRun = typeof ragQueryRuns.$inferInsert;
export type RagQueryRunSource = typeof ragQueryRunSources.$inferSelect;
export type NewRagQueryRunSource = typeof ragQueryRunSources.$inferInsert;
export type RagQueryRunRelatedTerm =
  typeof ragQueryRunRelatedTerms.$inferSelect;
export type NewRagQueryRunRelatedTerm =
  typeof ragQueryRunRelatedTerms.$inferInsert;
export type RagConversationMessageRole =
  (typeof ragConversationMessageRole.enumValues)[number];
export type RagConversation = typeof ragConversations.$inferSelect;
export type NewRagConversation = typeof ragConversations.$inferInsert;
export type RagConversationMessage =
  typeof ragConversationMessages.$inferSelect;
export type NewRagConversationMessage =
  typeof ragConversationMessages.$inferInsert;
