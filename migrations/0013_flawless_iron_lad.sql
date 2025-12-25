CREATE TABLE "stripe_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"stripe_event_id" text NOT NULL,
	"stripe_event_type" text NOT NULL,
	"reference_id" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_webhook_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
DROP INDEX IF EXISTS "embedding_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "search_name_idx";--> statement-breakpoint
ALTER TABLE "candidates" DROP COLUMN IF EXISTS "embedding";