CREATE TYPE "public"."strategy_status" AS ENUM('pending', 'executing', 'polling', 'completed', 'error');--> statement-breakpoint
CREATE TABLE "sourcing_strategies" (
	"id" text PRIMARY KEY NOT NULL,
	"search_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"apify_payload" text NOT NULL,
	"status" "strategy_status" DEFAULT 'pending' NOT NULL,
	"task_id" text,
	"workflow_run_id" text,
	"candidates_found" integer DEFAULT 0,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sourcing_strategies" ADD CONSTRAINT "sourcing_strategies_search_id_search_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."search"("id") ON DELETE cascade ON UPDATE no action;