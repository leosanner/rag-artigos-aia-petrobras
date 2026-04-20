CREATE TYPE "public"."rag_indexing_run_item_status" AS ENUM('processing', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."rag_indexing_run_status" AS ENUM('queued', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"estimated_tokens" integer NOT NULL,
	"document_pipeline_version" text NOT NULL,
	"chunking_version" text NOT NULL,
	"embedding_model" text NOT NULL,
	"embedding_dimensions" integer NOT NULL,
	"embedding" vector(3072) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_chunks_chunk_index_non_negative" CHECK ("document_chunks"."chunk_index" >= 0),
	CONSTRAINT "document_chunks_content_non_empty" CHECK (length(btrim("document_chunks"."content")) > 0),
	CONSTRAINT "document_chunks_estimated_tokens_positive" CHECK ("document_chunks"."estimated_tokens" > 0),
	CONSTRAINT "document_chunks_embedding_dimensions_3072" CHECK ("document_chunks"."embedding_dimensions" = 3072)
);
--> statement-breakpoint
CREATE TABLE "rag_indexing_run_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"document_id" uuid,
	"title" text NOT NULL,
	"status" "rag_indexing_run_item_status" DEFAULT 'processing' NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rag_indexing_run_items_chunk_count_non_negative" CHECK ("rag_indexing_run_items"."chunk_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rag_indexing_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "rag_indexing_run_status" DEFAULT 'queued' NOT NULL,
	"document_id" uuid,
	"force" boolean DEFAULT false NOT NULL,
	"selected_count" integer DEFAULT 0 NOT NULL,
	"processed_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rag_indexing_runs_selected_count_non_negative" CHECK ("rag_indexing_runs"."selected_count" >= 0),
	CONSTRAINT "rag_indexing_runs_processed_count_non_negative" CHECK ("rag_indexing_runs"."processed_count" >= 0),
	CONSTRAINT "rag_indexing_runs_failed_count_non_negative" CHECK ("rag_indexing_runs"."failed_count" >= 0),
	CONSTRAINT "rag_indexing_runs_skipped_count_non_negative" CHECK ("rag_indexing_runs"."skipped_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_indexing_run_items" ADD CONSTRAINT "rag_indexing_run_items_run_id_rag_indexing_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."rag_indexing_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_indexing_run_items" ADD CONSTRAINT "rag_indexing_run_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_indexing_runs" ADD CONSTRAINT "rag_indexing_runs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_chunks_document_id_idx" ON "document_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_chunks_document_config_chunk_idx" ON "document_chunks" USING btree ("document_id","chunking_version","embedding_model","chunk_index");--> statement-breakpoint
CREATE INDEX "rag_indexing_run_items_run_id_idx" ON "rag_indexing_run_items" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "rag_indexing_run_items_document_id_idx" ON "rag_indexing_run_items" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "rag_indexing_runs_document_id_idx" ON "rag_indexing_runs" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rag_indexing_runs_one_active_idx" ON "rag_indexing_runs" USING btree ((1)) WHERE "rag_indexing_runs"."status" in ('queued', 'processing');