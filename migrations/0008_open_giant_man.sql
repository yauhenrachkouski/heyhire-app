ALTER TABLE "search" ADD COLUMN "status" text DEFAULT 'created' NOT NULL;--> statement-breakpoint
ALTER TABLE "search" ADD COLUMN "task_id" text;--> statement-breakpoint
ALTER TABLE "search" ADD COLUMN "progress" integer DEFAULT 0;