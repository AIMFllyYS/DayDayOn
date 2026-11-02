CREATE TABLE "moderation_violations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"category" text NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "moderation_violations" ADD CONSTRAINT "moderation_violations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moderation_violations_user_created_idx" ON "moderation_violations" USING btree ("user_id","created_at" DESC NULLS LAST);