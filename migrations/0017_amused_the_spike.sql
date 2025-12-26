ALTER TABLE "search" ADD COLUMN "parse_error" text;--> statement-breakpoint
ALTER TABLE "search" ADD COLUMN "parse_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "search" ADD COLUMN "scoring_model_id" text;--> statement-breakpoint
ALTER TABLE "search" ADD COLUMN "scoring_model_error" text;--> statement-breakpoint
ALTER TABLE "search" ADD COLUMN "scoring_model_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "search_candidates" ADD COLUMN "scoring_model_id" text;--> statement-breakpoint
ALTER TABLE "search_candidates" ADD COLUMN "scoring_attempts" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "search_candidates" ADD COLUMN "scoring_error" text;--> statement-breakpoint
ALTER TABLE "search_candidates" ADD COLUMN "scoring_error_at" timestamp;