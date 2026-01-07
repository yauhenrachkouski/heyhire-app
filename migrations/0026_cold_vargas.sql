-- First convert column to text to allow manipulation
ALTER TABLE "credit_transactions" ALTER COLUMN "credit_type" SET DATA TYPE text;

-- Migrate old values to new values
-- contact_lookup was used for email/phone reveals, defaulting to email_reveal for historical data
-- export was used for exports, mapping to general
UPDATE "credit_transactions" SET "credit_type" = 'email_reveal' WHERE "credit_type" = 'contact_lookup';
UPDATE "credit_transactions" SET "credit_type" = 'general' WHERE "credit_type" = 'export';

--> statement-breakpoint
-- Drop old enum
DROP TYPE "public"."credit_type";

--> statement-breakpoint
-- Create new enum with updated values
CREATE TYPE "public"."credit_type" AS ENUM('general', 'linkedin_reveal', 'email_reveal', 'phone_reveal');

--> statement-breakpoint
-- Convert column back to enum
ALTER TABLE "credit_transactions" ALTER COLUMN "credit_type" SET DATA TYPE "public"."credit_type" USING "credit_type"::"public"."credit_type";
