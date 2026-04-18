CREATE TYPE "public"."ingestion_run_item_status" AS ENUM('processing', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ingestion_run_status" AS ENUM('queued', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "ingestion_run_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"drive_file_id" text NOT NULL,
	"document_id" uuid,
	"title" text NOT NULL,
	"status" "ingestion_run_item_status" DEFAULT 'processing' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "ingestion_run_status" DEFAULT 'queued' NOT NULL,
	"max_documents" integer NOT NULL,
	"selected_count" integer DEFAULT 0 NOT NULL,
	"processed_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"skipped_existing_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingestion_runs_max_documents_positive" CHECK ("ingestion_runs"."max_documents" > 0),
	CONSTRAINT "ingestion_runs_selected_count_non_negative" CHECK ("ingestion_runs"."selected_count" >= 0),
	CONSTRAINT "ingestion_runs_processed_count_non_negative" CHECK ("ingestion_runs"."processed_count" >= 0),
	CONSTRAINT "ingestion_runs_failed_count_non_negative" CHECK ("ingestion_runs"."failed_count" >= 0),
	CONSTRAINT "ingestion_runs_skipped_existing_count_non_negative" CHECK ("ingestion_runs"."skipped_existing_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ingestion_run_items" ADD CONSTRAINT "ingestion_run_items_run_id_ingestion_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ingestion_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_run_items" ADD CONSTRAINT "ingestion_run_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingestion_run_items_run_id_idx" ON "ingestion_run_items" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "ingestion_run_items_document_id_idx" ON "ingestion_run_items" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "ingestion_run_items_drive_file_id_idx" ON "ingestion_run_items" USING btree ("drive_file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ingestion_runs_one_active_idx" ON "ingestion_runs" USING btree ((1)) WHERE "ingestion_runs"."status" in ('queued', 'processing');