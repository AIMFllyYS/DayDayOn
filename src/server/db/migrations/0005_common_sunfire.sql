CREATE TABLE "friend_pet_interactions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"actor_id" text NOT NULL,
	"target_friend_id" text NOT NULL,
	"kind" text NOT NULL,
	"treat_id" text,
	"target_local_date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "friend_pet_interactions" ADD CONSTRAINT "friend_pet_interactions_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_pet_interactions" ADD CONSTRAINT "friend_pet_interactions_target_friend_id_user_id_fk" FOREIGN KEY ("target_friend_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "friend_pet_interactions_actor_target_kind_created_idx" ON "friend_pet_interactions" USING btree ("actor_id","target_friend_id","kind","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "friend_pet_interactions_actor_target_date_idx" ON "friend_pet_interactions" USING btree ("actor_id","target_friend_id","target_local_date");