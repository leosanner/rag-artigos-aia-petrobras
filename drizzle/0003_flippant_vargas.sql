CREATE TYPE "public"."rag_query_run_error_code" AS ENUM('generation_failed', 'generation_unavailable');--> statement-breakpoint
CREATE TYPE "public"."rag_query_run_status" AS ENUM('answered', 'answered_no_evidence', 'generation_failed', 'generation_unavailable');--> statement-breakpoint
CREATE TABLE "rag_query_run_related_terms" (
	"run_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"term" text NOT NULL,
	"ngram_size" integer NOT NULL,
	"frequency" integer NOT NULL,
	"source_coverage_count" integer NOT NULL,
	CONSTRAINT "rag_query_run_related_terms_pk" PRIMARY KEY("run_id","rank"),
	CONSTRAINT "rag_query_run_related_terms_rank_positive" CHECK ("rag_query_run_related_terms"."rank" > 0),
	CONSTRAINT "rag_query_run_related_terms_rank_max_eight" CHECK ("rag_query_run_related_terms"."rank" <= 8),
	CONSTRAINT "rag_query_run_related_terms_term_non_empty" CHECK (length(btrim("rag_query_run_related_terms"."term")) > 0),
	CONSTRAINT "rag_query_run_related_terms_ngram_size_positive" CHECK ("rag_query_run_related_terms"."ngram_size" > 0),
	CONSTRAINT "rag_query_run_related_terms_frequency_positive" CHECK ("rag_query_run_related_terms"."frequency" > 0),
	CONSTRAINT "rag_query_run_related_terms_source_coverage_count_non_negative" CHECK ("rag_query_run_related_terms"."source_coverage_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rag_query_run_sources" (
	"run_id" uuid NOT NULL,
	"source_number" integer NOT NULL,
	"chunk_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"document_title" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"excerpt" text NOT NULL,
	"score" double precision NOT NULL,
	"document_pipeline_version" text NOT NULL,
	"chunking_version" text NOT NULL,
	"embedding_model" text NOT NULL,
	"cited_in_answer" boolean NOT NULL,
	CONSTRAINT "rag_query_run_sources_pk" PRIMARY KEY("run_id","source_number"),
	CONSTRAINT "rag_query_run_sources_source_number_positive" CHECK ("rag_query_run_sources"."source_number" > 0),
	CONSTRAINT "rag_query_run_sources_chunk_index_non_negative" CHECK ("rag_query_run_sources"."chunk_index" >= 0),
	CONSTRAINT "rag_query_run_sources_document_title_non_empty" CHECK (length(btrim("rag_query_run_sources"."document_title")) > 0),
	CONSTRAINT "rag_query_run_sources_excerpt_non_empty" CHECK (length(btrim("rag_query_run_sources"."excerpt")) > 0)
);
--> statement-breakpoint
CREATE TABLE "rag_query_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"mode" text NOT NULL,
	"status" "rag_query_run_status" NOT NULL,
	"error_code" "rag_query_run_error_code",
	"top_k" integer NOT NULL,
	"retrieval_strategy" text NOT NULL,
	"candidate_top_k" integer NOT NULL,
	"prompt_version" text NOT NULL,
	"generation_model" text NOT NULL,
	"embedding_model" text NOT NULL,
	"latency_ms" integer NOT NULL,
	"embedding_input_tokens" integer NOT NULL,
	"embedding_cost_usd" double precision NOT NULL,
	"generation_input_tokens" integer,
	"generation_output_tokens" integer,
	"generation_total_tokens" integer,
	"generation_cost_usd" double precision,
	"total_cost_usd" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rag_query_runs_question_non_empty" CHECK (length(btrim("rag_query_runs"."question")) > 0),
	CONSTRAINT "rag_query_runs_answer_non_empty_when_present" CHECK ("rag_query_runs"."answer" is null or length(btrim("rag_query_runs"."answer")) > 0),
	CONSTRAINT "rag_query_runs_mode_global" CHECK ("rag_query_runs"."mode" = 'global'),
	CONSTRAINT "rag_query_runs_top_k_positive" CHECK ("rag_query_runs"."top_k" > 0),
	CONSTRAINT "rag_query_runs_retrieval_strategy_valid" CHECK ("rag_query_runs"."retrieval_strategy" in ('standard', 'explore')),
	CONSTRAINT "rag_query_runs_candidate_top_k_positive" CHECK ("rag_query_runs"."candidate_top_k" > 0),
	CONSTRAINT "rag_query_runs_latency_ms_non_negative" CHECK ("rag_query_runs"."latency_ms" >= 0),
	CONSTRAINT "rag_query_runs_embedding_input_tokens_non_negative" CHECK ("rag_query_runs"."embedding_input_tokens" >= 0),
	CONSTRAINT "rag_query_runs_embedding_cost_usd_non_negative" CHECK ("rag_query_runs"."embedding_cost_usd" >= 0),
	CONSTRAINT "rag_query_runs_generation_input_tokens_non_negative" CHECK ("rag_query_runs"."generation_input_tokens" is null or "rag_query_runs"."generation_input_tokens" >= 0),
	CONSTRAINT "rag_query_runs_generation_output_tokens_non_negative" CHECK ("rag_query_runs"."generation_output_tokens" is null or "rag_query_runs"."generation_output_tokens" >= 0),
	CONSTRAINT "rag_query_runs_generation_total_tokens_non_negative" CHECK ("rag_query_runs"."generation_total_tokens" is null or "rag_query_runs"."generation_total_tokens" >= 0),
	CONSTRAINT "rag_query_runs_generation_cost_usd_non_negative" CHECK ("rag_query_runs"."generation_cost_usd" is null or "rag_query_runs"."generation_cost_usd" >= 0),
	CONSTRAINT "rag_query_runs_total_cost_usd_non_negative" CHECK ("rag_query_runs"."total_cost_usd" >= 0),
	CONSTRAINT "rag_query_runs_generation_metrics_all_or_none" CHECK (
        (
          "rag_query_runs"."generation_input_tokens" is null and
          "rag_query_runs"."generation_output_tokens" is null and
          "rag_query_runs"."generation_total_tokens" is null and
          "rag_query_runs"."generation_cost_usd" is null
        ) or (
          "rag_query_runs"."generation_input_tokens" is not null and
          "rag_query_runs"."generation_output_tokens" is not null and
          "rag_query_runs"."generation_total_tokens" is not null and
          "rag_query_runs"."generation_cost_usd" is not null
        )
      ),
	CONSTRAINT "rag_query_runs_error_code_matches_status" CHECK (
        (
          "rag_query_runs"."status" in ('answered', 'answered_no_evidence') and
          "rag_query_runs"."error_code" is null
        ) or (
          "rag_query_runs"."status" = 'generation_failed' and
          "rag_query_runs"."error_code" = 'generation_failed'
        ) or (
          "rag_query_runs"."status" = 'generation_unavailable' and
          "rag_query_runs"."error_code" = 'generation_unavailable'
        )
      )
);
--> statement-breakpoint
ALTER TABLE "rag_query_run_related_terms" ADD CONSTRAINT "rag_query_run_related_terms_run_id_rag_query_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."rag_query_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_query_run_sources" ADD CONSTRAINT "rag_query_run_sources_run_id_rag_query_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."rag_query_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rag_query_run_related_terms_run_id_idx" ON "rag_query_run_related_terms" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "rag_query_run_sources_run_id_idx" ON "rag_query_run_sources" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "rag_query_runs_created_at_idx" ON "rag_query_runs" USING btree ("created_at");