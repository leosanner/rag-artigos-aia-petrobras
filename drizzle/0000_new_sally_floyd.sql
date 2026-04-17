CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending', 'processed', 'failed');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"drive_file_id" text NOT NULL,
	"origin" text DEFAULT 'google_drive' NOT NULL,
	"file_hash" text NOT NULL,
	"pipeline_version" text NOT NULL,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"doi" text,
	"authors" text,
	"publication_year" integer,
	"notes" text,
	"raw_text" text,
	"refined_text" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_drive_file_id_unique" UNIQUE("drive_file_id")
);
