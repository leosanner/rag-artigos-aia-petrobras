CREATE TYPE "public"."rag_conversation_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TABLE "rag_conversation_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "rag_conversation_message_role" NOT NULL,
	"content" text NOT NULL,
	"trace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rag_conversation_messages_content_non_empty" CHECK (length(btrim("rag_conversation_messages"."content")) > 0),
	CONSTRAINT "rag_conversation_messages_assistant_requires_trace" CHECK ("rag_conversation_messages"."role" <> 'assistant' or "rag_conversation_messages"."trace_id" is not null),
	CONSTRAINT "rag_conversation_messages_user_has_no_trace" CHECK ("rag_conversation_messages"."role" <> 'user' or "rag_conversation_messages"."trace_id" is null)
);
--> statement-breakpoint
CREATE TABLE "rag_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone,
	CONSTRAINT "rag_conversations_title_non_empty" CHECK ("rag_conversations"."title" is null or length(btrim("rag_conversations"."title")) > 0)
);
--> statement-breakpoint
ALTER TABLE "rag_conversation_messages" ADD CONSTRAINT "rag_conversation_messages_conversation_id_rag_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."rag_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_conversation_messages" ADD CONSTRAINT "rag_conversation_messages_trace_id_rag_query_runs_id_fk" FOREIGN KEY ("trace_id") REFERENCES "public"."rag_query_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rag_conversation_messages_conversation_created_at_idx" ON "rag_conversation_messages" USING btree ("conversation_id","created_at","id");--> statement-breakpoint
CREATE INDEX "rag_conversations_last_message_at_idx" ON "rag_conversations" USING btree ("last_message_at" desc);