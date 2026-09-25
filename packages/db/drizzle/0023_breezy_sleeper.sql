CREATE TABLE "challenge_evaluation_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"source_digest" varchar(64) NOT NULL,
	"review_digest" varchar(64) NOT NULL,
	"review" jsonb NOT NULL,
	"ceremony_challenge" text,
	"ceremony_kind" varchar(16),
	"webauthn_origin" text,
	"relying_party_id" varchar(255),
	"credential_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant_passkeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"transports" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"device_type" varchar(16) NOT NULL,
	"backed_up" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "challenge_evaluation_approvals" ADD CONSTRAINT "challenge_evaluation_approvals_attempt_id_challenge_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."challenge_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_passkeys" ADD CONSTRAINT "participant_passkeys_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_evaluation_approvals_active_unique" ON "challenge_evaluation_approvals" USING btree ("attempt_id","source_digest","review_digest") WHERE "challenge_evaluation_approvals"."consumed_at" is null;--> statement-breakpoint
CREATE INDEX "challenge_evaluation_approvals_attempt_index" ON "challenge_evaluation_approvals" USING btree ("attempt_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "participant_passkeys_credential_id_unique" ON "participant_passkeys" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "participant_passkeys_participant_id_index" ON "participant_passkeys" USING btree ("participant_id");