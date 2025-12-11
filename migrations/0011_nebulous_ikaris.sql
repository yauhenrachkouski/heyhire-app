ALTER TABLE "candidates" ADD COLUMN "registered_at" timestamp;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "top_skills" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "open_to_work" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "hiring" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "current_positions" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "certifications" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "recommendations" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "languages" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "projects" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "publications" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "featured" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "verified" boolean DEFAULT false;