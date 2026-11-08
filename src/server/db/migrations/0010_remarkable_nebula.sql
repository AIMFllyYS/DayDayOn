CREATE TABLE "step_metrics" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" text NOT NULL,
	"local_date" date NOT NULL,
	"steps" integer DEFAULT 0 NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "remind_mode" text DEFAULT 'off' NOT NULL;--> statement-breakpoint
UPDATE "profiles" SET "remind_mode" = 'in-app' WHERE "remind_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "step_metrics" ADD CONSTRAINT "step_metrics_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "step_metrics_user_id_local_date_key" ON "step_metrics" USING btree ("user_id","local_date");