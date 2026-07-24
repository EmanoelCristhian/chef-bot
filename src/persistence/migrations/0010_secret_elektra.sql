CREATE TABLE "pending_mismatch_selection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" text NOT NULL,
	"store_id" uuid NOT NULL,
	"routine_check_ids" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pending_mismatch_selection_chat_id_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
ALTER TABLE "pending_mismatch_selection" ADD CONSTRAINT "pending_mismatch_selection_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;