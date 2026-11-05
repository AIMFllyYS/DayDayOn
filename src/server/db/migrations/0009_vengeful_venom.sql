CREATE TABLE "checkin_revisions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" text NOT NULL,
	"checkin_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"module" text NOT NULL,
	"local_date" date NOT NULL,
	"action" text NOT NULL,
	"origin" text DEFAULT 'manual' NOT NULL,
	"reason" text,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checkin_revisions" ADD CONSTRAINT "checkin_revisions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkin_revisions_checkin_id_idx" ON "checkin_revisions" USING btree ("checkin_id","created_at");--> statement-breakpoint
CREATE INDEX "checkin_revisions_user_id_created_at_idx" ON "checkin_revisions" USING btree ("user_id","created_at");