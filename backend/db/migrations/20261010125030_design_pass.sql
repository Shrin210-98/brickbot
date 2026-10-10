-- Modify "salesman_profile" table
ALTER TABLE "public"."salesman_profile" ADD COLUMN "tagline" text NULL, ADD COLUMN "years_experience" smallint NULL, ADD COLUMN "deals_closed" integer NULL, ADD COLUMN "specialties" text[] NOT NULL DEFAULT '{}', ADD COLUMN "process_steps" jsonb NOT NULL DEFAULT '[]';
-- Create "testimonials" table
CREATE TABLE "public"."testimonials" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "author_name" text NOT NULL, "author_title" text NULL, "author_photo_url" text NULL, "quote" text NOT NULL, "rating" smallint NULL, "listing_id" uuid NULL, "is_published" boolean NOT NULL DEFAULT false, "position" smallint NOT NULL DEFAULT 0, "created_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "testimonials_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings" ("id") ON UPDATE NO ACTION ON DELETE SET NULL, CONSTRAINT "testimonials_rating_check" CHECK ((rating >= 1) AND (rating <= 5)));
-- Create index "testimonials_is_published_position_idx" to table: "testimonials"
CREATE INDEX "testimonials_is_published_position_idx" ON "public"."testimonials" ("is_published", "position");
