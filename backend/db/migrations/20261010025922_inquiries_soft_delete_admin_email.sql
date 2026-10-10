-- Modify "listings" table
ALTER TABLE "public"."listings" ADD COLUMN "deleted_at" timestamptz NULL;
-- Modify "salesman_profile" table
ALTER TABLE "public"."salesman_profile" ADD COLUMN "admin_email" text NOT NULL DEFAULT '';
-- Create "inquiries" table
CREATE TABLE "public"."inquiries" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "listing_id" uuid NULL, "name" text NOT NULL, "phone" text NOT NULL DEFAULT '', "email" text NOT NULL DEFAULT '', "message" text NOT NULL DEFAULT '', "source" text NOT NULL DEFAULT 'form', "status" text NOT NULL DEFAULT 'new', "admin_note" text NOT NULL DEFAULT '', "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "inquiries_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings" ("id") ON UPDATE NO ACTION ON DELETE SET NULL, CONSTRAINT "inquiries_contact_check" CHECK ((phone <> ''::text) OR (email <> ''::text)), CONSTRAINT "inquiries_source_check" CHECK (source = ANY (ARRAY['form'::text, 'chat'::text])), CONSTRAINT "inquiries_status_check" CHECK (status = ANY (ARRAY['new'::text, 'contacted'::text, 'closed'::text, 'spam'::text])));
-- Create index "inquiries_listing_id_idx" to table: "inquiries"
CREATE INDEX "inquiries_listing_id_idx" ON "public"."inquiries" ("listing_id");
-- Create index "inquiries_status_created_at_idx" to table: "inquiries"
CREATE INDEX "inquiries_status_created_at_idx" ON "public"."inquiries" ("status", "created_at" DESC);
