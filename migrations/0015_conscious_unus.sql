CREATE TABLE "organization_share_link" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"created_by_user_id" text,
	"token_hash" text NOT NULL,
	"expires_at" timestamp,
	"max_views" integer,
	"view_count" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp,
	"preset" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_viewed_at" timestamp,
	CONSTRAINT "organization_share_link_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "organization_share_link" ADD CONSTRAINT "organization_share_link_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_share_link" ADD CONSTRAINT "organization_share_link_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;