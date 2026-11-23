CREATE TABLE "todo_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" text NOT NULL,
	"todo_id" uuid,
	"event_type" text NOT NULL,
	"todo_title" text NOT NULL,
	"group_name" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "todo_groups" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "todo_tags" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "todos" ALTER COLUMN "priority" SET DEFAULT 'not-important-not-urgent';--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "status" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "abandoned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "abandon_reason" text;--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "todo_events" ADD CONSTRAINT "todo_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_events" ADD CONSTRAINT "todo_events_todo_id_todos_id_fk" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_groups" ADD CONSTRAINT "todo_groups_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_tags" ADD CONSTRAINT "todo_tags_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "todo_events_user_occurred_idx" ON "todo_events" USING btree ("user_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "todo_events_todo_occurred_idx" ON "todo_events" USING btree ("todo_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "todo_groups_user_id_name_key" ON "todo_groups" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "todo_groups_user_id_default_key" ON "todo_groups" USING btree ("user_id") WHERE "todo_groups"."is_default" = true;--> statement-breakpoint
CREATE INDEX "todo_groups_user_id_sort_order_idx" ON "todo_groups" USING btree ("user_id","sort_order","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "todo_tags_user_id_name_key" ON "todo_tags" USING btree ("user_id","name");--> statement-breakpoint
INSERT INTO "todo_groups" ("user_id", "name", "is_default", "sort_order")
SELECT DISTINCT "user_id", '默认待办', true, 0
FROM "todos"
ON CONFLICT DO NOTHING;--> statement-breakpoint
WITH ranked AS (
	SELECT
		t."id",
		g."id" AS default_group_id,
		ROW_NUMBER() OVER (
			PARTITION BY t."user_id"
			ORDER BY t."due_at" ASC NULLS LAST, t."created_at" ASC, t."id" ASC
		) - 1 AS next_sort_order
	FROM "todos" t
	INNER JOIN "todo_groups" g
		ON g."user_id" = t."user_id" AND g."is_default" = true
)
UPDATE "todos" t
SET
	"group_id" = ranked.default_group_id,
	"status" = CASE WHEN t."done_at" IS NOT NULL THEN 'done' ELSE 'open' END,
	"settled_at" = t."done_at",
	"priority" = CASE
		WHEN t."priority" = 'important' THEN 'urgent-important'
		WHEN t."priority" = 'normal' THEN 'not-important-not-urgent'
		ELSE t."priority"
	END,
	"sort_order" = ranked.next_sort_order
FROM ranked
WHERE t."id" = ranked."id";--> statement-breakpoint
INSERT INTO "todo_events" ("user_id", "todo_id", "event_type", "todo_title", "group_name", "meta", "occurred_at")
SELECT
	t."user_id",
	t."id",
	'created',
	t."title",
	'默认待办',
	jsonb_build_object('priority', t."priority", 'dueAt', t."due_at"),
	t."created_at"
FROM "todos" t;--> statement-breakpoint
INSERT INTO "todo_events" ("user_id", "todo_id", "event_type", "todo_title", "group_name", "meta", "occurred_at")
SELECT
	t."user_id",
	t."id",
	'completed',
	t."title",
	'默认待办',
	'{}'::jsonb,
	t."done_at"
FROM "todos" t
WHERE t."done_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "todos" ALTER COLUMN "group_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_group_id_todo_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."todo_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "todos_user_status_group_sort_idx" ON "todos" USING btree ("user_id","status","group_id","sort_order","due_at","created_at");--> statement-breakpoint
CREATE INDEX "todos_user_status_settled_idx" ON "todos" USING btree ("user_id","status","settled_at","id");--> statement-breakpoint
CREATE INDEX "todos_user_status_priority_created_idx" ON "todos" USING btree ("user_id","status","priority","created_at","id");--> statement-breakpoint
CREATE INDEX "todos_tags_gin_idx" ON "todos" USING gin ("tags");
