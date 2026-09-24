ALTER TABLE "participant_badges" ADD COLUMN "display_name" varchar(200);--> statement-breakpoint
ALTER TABLE "participant_badges" ADD COLUMN "one_liner" varchar(120);--> statement-breakpoint
ALTER TABLE "participant_badges" ADD COLUMN "link_url" text;--> statement-breakpoint
ALTER TABLE "participant_badges" ADD COLUMN "placement" varchar(120);