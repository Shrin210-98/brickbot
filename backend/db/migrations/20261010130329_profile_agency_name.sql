-- Modify "salesman_profile" table
ALTER TABLE "public"."salesman_profile" ADD COLUMN "agency_name" text NULL, ADD COLUMN "headline" text NULL, ADD COLUMN "license_no" text NULL, ADD COLUMN "socials" jsonb NOT NULL DEFAULT '{}';
