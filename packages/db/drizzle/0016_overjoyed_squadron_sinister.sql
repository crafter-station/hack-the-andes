ALTER TABLE "participant_badges" ADD COLUMN "picture_source" "picture_source";--> statement-breakpoint
ALTER TABLE "participant_badges" ADD COLUMN "picture_url" text;--> statement-breakpoint
ALTER TABLE "participant_badges" ADD COLUMN "custom_picture_url" text;--> statement-breakpoint
ALTER TABLE "participant_badges" ADD COLUMN "custom_picture_pathname" text;--> statement-breakpoint
ALTER TABLE "participant_badges" ADD COLUMN "pending_picture_pathname" text;--> statement-breakpoint
ALTER TABLE "participant_badges" ADD COLUMN "pending_picture_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "participant_badges" ADD COLUMN "picture_upload_window_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "participant_badges" ADD COLUMN "picture_upload_count" integer DEFAULT 0 NOT NULL;