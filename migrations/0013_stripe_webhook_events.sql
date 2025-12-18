CREATE TABLE "stripe_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"stripe_event_id" text NOT NULL,
	"stripe_event_type" text NOT NULL,
	"reference_id" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_webhook_events_stripe_event_id_unique" ON "stripe_webhook_events" ("stripe_event_id");
