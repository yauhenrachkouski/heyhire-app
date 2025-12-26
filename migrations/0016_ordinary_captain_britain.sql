ALTER TABLE "search" ADD COLUMN "parse_response" text;--> statement-breakpoint
ALTER TABLE "search" ADD COLUMN "parse_schema_version" integer;--> statement-breakpoint
ALTER TABLE "search" ADD COLUMN "scoring_model" text;--> statement-breakpoint
ALTER TABLE "search" ADD COLUMN "scoring_model_version" text;--> statement-breakpoint
ALTER TABLE "search_candidates" ADD COLUMN "scoring_result" text;--> statement-breakpoint
ALTER TABLE "search_candidates" ADD COLUMN "scoring_version" text;--> statement-breakpoint
ALTER TABLE "search_candidates" ADD COLUMN "scoring_updated_at" timestamp;