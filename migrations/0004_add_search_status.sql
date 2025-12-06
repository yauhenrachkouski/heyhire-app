DO $$ BEGIN
 CREATE TYPE "public"."search_status" AS ENUM('searching', 'completed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "search" ADD COLUMN "status" "search_status" DEFAULT 'searching' NOT NULL;--> statement-breakpoint
ALTER TABLE "search" ADD COLUMN "completed_at" timestamp;

