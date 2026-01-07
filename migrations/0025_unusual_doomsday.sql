CREATE TABLE "candidate_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"candidate_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"revealed_by_user_id" text NOT NULL,
	"email" text,
	"phone" text,
	"findymail_id" text,
	"findymail_confidence" integer,
	"findymail_source" text,
	"raw_response" text,
	"credit_transaction_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_contacts_candidate_id_organization_id_unique" UNIQUE("candidate_id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "candidate_contacts" ADD CONSTRAINT "candidate_contacts_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_contacts" ADD CONSTRAINT "candidate_contacts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_contacts" ADD CONSTRAINT "candidate_contacts_revealed_by_user_id_user_id_fk" FOREIGN KEY ("revealed_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_contacts" ADD CONSTRAINT "candidate_contacts_credit_transaction_id_credit_transactions_id_fk" FOREIGN KEY ("credit_transaction_id") REFERENCES "public"."credit_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_contacts_organization_idx" ON "candidate_contacts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "candidate_contacts_candidate_idx" ON "candidate_contacts" USING btree ("candidate_id");