-- Create "chat_sessions" table
CREATE TABLE "public"."chat_sessions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "visitor_id" uuid NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"));
-- Create "chat_messages" table
CREATE TABLE "public"."chat_messages" ("id" bigint NOT NULL GENERATED ALWAYS AS IDENTITY, "session_id" uuid NOT NULL, "role" text NOT NULL, "content" jsonb NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions" ("id") ON UPDATE NO ACTION ON DELETE CASCADE, CONSTRAINT "chat_messages_content_check" CHECK (jsonb_typeof(content) = 'array'::text), CONSTRAINT "chat_messages_role_check" CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text])));
-- Create index "chat_messages_session_id_id_idx" to table: "chat_messages"
CREATE INDEX "chat_messages_session_id_id_idx" ON "public"."chat_messages" ("session_id", "id");
-- Modify "inquiries" table
ALTER TABLE "public"."inquiries" ADD COLUMN "chat_session_id" uuid NULL, ADD CONSTRAINT "inquiries_chat_session_id_fkey" FOREIGN KEY ("chat_session_id") REFERENCES "public"."chat_sessions" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Create index "inquiries_chat_session_id_key" to table: "inquiries"
CREATE UNIQUE INDEX "inquiries_chat_session_id_key" ON "public"."inquiries" ("chat_session_id") WHERE (chat_session_id IS NOT NULL);
