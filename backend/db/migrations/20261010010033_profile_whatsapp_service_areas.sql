-- Modify "salesman_profile" table
ALTER TABLE "public"."salesman_profile" ADD COLUMN "whatsapp_number" text NOT NULL DEFAULT '', ADD COLUMN "service_areas" text[] NOT NULL DEFAULT '{}';
