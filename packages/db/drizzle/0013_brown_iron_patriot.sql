CREATE TABLE "funnel_email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"stage" varchar(32) NOT NULL,
	"scope_id" varchar(255) NOT NULL,
	"status" varchar(16) DEFAULT 'sending' NOT NULL,
	"trigger_run_id" text NOT NULL,
	"sent_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "funnel_email_deliveries_user_stage_scope_unique" ON "funnel_email_deliveries" USING btree ("clerk_user_id","stage","scope_id");--> statement-breakpoint
CREATE INDEX "funnel_email_deliveries_status_index" ON "funnel_email_deliveries" USING btree ("status");
