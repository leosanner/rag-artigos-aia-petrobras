ALTER TYPE "public"."rag_query_run_error_code" ADD VALUE 'reranking_failed';--> statement-breakpoint
ALTER TYPE "public"."rag_query_run_error_code" ADD VALUE 'reranking_unavailable';--> statement-breakpoint
ALTER TYPE "public"."rag_query_run_status" ADD VALUE 'reranking_failed';--> statement-breakpoint
ALTER TYPE "public"."rag_query_run_status" ADD VALUE 'reranking_unavailable';--> statement-breakpoint
ALTER TABLE "rag_query_run_sources" RENAME COLUMN "score" TO "retrieval_score";--> statement-breakpoint
ALTER TABLE "rag_query_runs" DROP CONSTRAINT "rag_query_runs_retrieval_strategy_valid";--> statement-breakpoint
ALTER TABLE "rag_query_runs" DROP CONSTRAINT "rag_query_runs_error_code_matches_status";--> statement-breakpoint
ALTER TABLE "rag_query_run_sources" ADD COLUMN "rerank_score" double precision;--> statement-breakpoint
ALTER TABLE "rag_query_runs" ADD COLUMN "reranker_provider" text;--> statement-breakpoint
ALTER TABLE "rag_query_runs" ADD COLUMN "reranker_model" text;--> statement-breakpoint
ALTER TABLE "rag_query_runs" ADD COLUMN "reranking_latency_ms" integer;--> statement-breakpoint
ALTER TABLE "rag_query_runs" ADD COLUMN "reranking_candidates_evaluated" integer;--> statement-breakpoint
ALTER TABLE "rag_query_runs" ADD COLUMN "reranking_input_tokens" integer;--> statement-breakpoint
ALTER TABLE "rag_query_runs" ADD COLUMN "reranking_cost_usd" double precision;--> statement-breakpoint
ALTER TABLE "rag_query_runs" ADD CONSTRAINT "rag_query_runs_reranking_latency_ms_non_negative" CHECK ("rag_query_runs"."reranking_latency_ms" is null or "rag_query_runs"."reranking_latency_ms" >= 0);--> statement-breakpoint
ALTER TABLE "rag_query_runs" ADD CONSTRAINT "rag_query_runs_reranking_candidates_evaluated_positive" CHECK ("rag_query_runs"."reranking_candidates_evaluated" is null or "rag_query_runs"."reranking_candidates_evaluated" > 0);--> statement-breakpoint
ALTER TABLE "rag_query_runs" ADD CONSTRAINT "rag_query_runs_reranking_input_tokens_non_negative" CHECK ("rag_query_runs"."reranking_input_tokens" is null or "rag_query_runs"."reranking_input_tokens" >= 0);--> statement-breakpoint
ALTER TABLE "rag_query_runs" ADD CONSTRAINT "rag_query_runs_reranking_cost_usd_non_negative" CHECK ("rag_query_runs"."reranking_cost_usd" is null or "rag_query_runs"."reranking_cost_usd" >= 0);--> statement-breakpoint
ALTER TABLE "rag_query_runs" ADD CONSTRAINT "rag_query_runs_reranking_metrics_all_or_none" CHECK (
        (
          "rag_query_runs"."reranker_provider" is null and
          "rag_query_runs"."reranker_model" is null and
          "rag_query_runs"."reranking_latency_ms" is null and
          "rag_query_runs"."reranking_candidates_evaluated" is null and
          "rag_query_runs"."reranking_input_tokens" is null and
          "rag_query_runs"."reranking_cost_usd" is null
        ) or (
          "rag_query_runs"."reranker_provider" is not null and
          "rag_query_runs"."reranker_model" is not null and
          "rag_query_runs"."reranking_latency_ms" is not null and
          "rag_query_runs"."reranking_candidates_evaluated" is not null and
          "rag_query_runs"."reranking_input_tokens" is not null and
          "rag_query_runs"."reranking_cost_usd" is not null and
          "rag_query_runs"."retrieval_strategy" = 'rerank' and
          "rag_query_runs"."status" = 'answered'
        )
      );--> statement-breakpoint
ALTER TABLE "rag_query_runs" ADD CONSTRAINT "rag_query_runs_retrieval_strategy_valid" CHECK ("rag_query_runs"."retrieval_strategy" in ('standard', 'explore', 'rerank'));--> statement-breakpoint
ALTER TABLE "rag_query_runs" ADD CONSTRAINT "rag_query_runs_error_code_matches_status" CHECK (
        (
          ("rag_query_runs"."status")::text in ('answered', 'answered_no_evidence') and
          "rag_query_runs"."error_code" is null
        ) or (
          ("rag_query_runs"."status")::text = 'generation_failed' and
          ("rag_query_runs"."error_code")::text = 'generation_failed'
        ) or (
          ("rag_query_runs"."status")::text = 'generation_unavailable' and
          ("rag_query_runs"."error_code")::text = 'generation_unavailable'
        ) or (
          ("rag_query_runs"."status")::text = 'reranking_failed' and
          ("rag_query_runs"."error_code")::text = 'reranking_failed'
        ) or (
          ("rag_query_runs"."status")::text = 'reranking_unavailable' and
          ("rag_query_runs"."error_code")::text = 'reranking_unavailable'
        )
      );
