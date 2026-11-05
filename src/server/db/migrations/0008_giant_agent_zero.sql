ALTER TABLE "checkins" ADD COLUMN "score" numeric(3, 1);--> statement-breakpoint
ALTER TABLE "checkins" ADD COLUMN "is_valid" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "checkins" ADD COLUMN "verdict" jsonb;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "referee_rules" jsonb;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "deadline_date" date;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "referee_tier" text DEFAULT 'balanced-glycemic' NOT NULL;