CREATE TYPE "public"."credit_type" AS ENUM('contact_lookup', 'export', 'general');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('subscription_grant', 'manual_grant', 'purchase', 'consumption');--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" "transaction_type" NOT NULL,
	"credit_type" "credit_type" NOT NULL,
	"amount" integer NOT NULL,
	"balance_before" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"related_entity_id" text,
	"description" text NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "credits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "search" DROP COLUMN "completed_at";--> statement-breakpoint
DROP TYPE "public"."search_status";