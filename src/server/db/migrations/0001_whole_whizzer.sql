CREATE TABLE "account_tombstones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email_hash" text NOT NULL,
	"period_key" text NOT NULL,
	"weekly_limit_micros" bigint NOT NULL,
	"weekly_used_micros" bigint NOT NULL,
	"ai_run_ids" jsonb NOT NULL,
	"redeem_attempt_ids" jsonb NOT NULL,
	"deleted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "account_tombstones_email_hash_key" ON "account_tombstones" USING btree ("email_hash");--> statement-breakpoint
CREATE INDEX "account_tombstones_deleted_at_idx" ON "account_tombstones" USING btree ("deleted_at");