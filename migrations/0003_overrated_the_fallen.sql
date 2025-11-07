CREATE TYPE "public"."candidate_source" AS ENUM('rapidapi');--> statement-breakpoint
CREATE TYPE "public"."candidate_status" AS ENUM('new', 'reviewing', 'contacted', 'rejected', 'hired');--> statement-breakpoint
CREATE TYPE "public"."contact_source" AS ENUM('linkedin', 'surfe', 'contactout');--> statement-breakpoint
CREATE TYPE "public"."scrape_status" AS ENUM('pending', 'scraping', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" text PRIMARY KEY NOT NULL,
	"linkedin_url" text NOT NULL,
	"linkedin_username" text,
	"linkedin_urn" text,
	"source" "candidate_source" DEFAULT 'rapidapi' NOT NULL,
	"full_name" text,
	"first_name" text,
	"last_name" text,
	"headline" text,
	"summary" text,
	"photo_url" text,
	"cover_url" text,
	"location" text,
	"is_premium" boolean DEFAULT false,
	"is_influencer" boolean DEFAULT false,
	"follower_count" integer,
	"connection_count" integer,
	"experiences" text,
	"educations" text,
	"skills" text,
	"certifications" text,
	"languages" text,
	"publications" text,
	"raw_data" text,
	"scrape_status" "scrape_status" DEFAULT 'pending' NOT NULL,
	"scrape_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "candidates_linkedin_url_unique" UNIQUE("linkedin_url")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"candidate_id" text NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"source" "contact_source" NOT NULL,
	"verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_candidates" (
	"id" text PRIMARY KEY NOT NULL,
	"search_id" text NOT NULL,
	"candidate_id" text NOT NULL,
	"match_score" integer,
	"notes" text,
	"status" "candidate_status" DEFAULT 'new',
	"source_provider" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "search_candidates_search_id_candidate_id_unique" UNIQUE("search_id","candidate_id")
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_candidates" ADD CONSTRAINT "search_candidates_search_id_search_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."search"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_candidates" ADD CONSTRAINT "search_candidates_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;