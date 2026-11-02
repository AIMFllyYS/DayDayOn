CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"sender_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"content" varchar(300) NOT NULL,
	"idempotency_key" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_conversation_idx" ON "chat_messages" USING btree ("sender_id","recipient_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "chat_messages_recipient_unread_idx" ON "chat_messages" USING btree ("recipient_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_sender_idempotency_idx" ON "chat_messages" USING btree ("sender_id","idempotency_key");