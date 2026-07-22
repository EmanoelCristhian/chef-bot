CREATE TABLE "awaiting_ingestion_count" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"routine_id" uuid NOT NULL,
	"collaborator_telegram_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"raw_text" text NOT NULL,
	"date" date NOT NULL,
	"items" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_ingestion_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"date" date NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_ingestion_run_store_id_date_unique" UNIQUE("store_id","date")
);
--> statement-breakpoint
ALTER TABLE "awaiting_ingestion_count" ADD CONSTRAINT "awaiting_ingestion_count_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awaiting_ingestion_count" ADD CONSTRAINT "awaiting_ingestion_count_routine_id_routine_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routine"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_ingestion_run" ADD CONSTRAINT "daily_ingestion_run_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;