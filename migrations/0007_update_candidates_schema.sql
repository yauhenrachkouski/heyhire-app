-- Migration: Drop and recreate candidates and search_candidates tables
-- This resolves conflicts from previous schema changes

-- Step 1: Drop tables with foreign keys first
DROP TABLE IF EXISTS "search_candidates" CASCADE;
DROP TABLE IF EXISTS "contacts" CASCADE;
DROP TABLE IF EXISTS "candidates" CASCADE;

-- Step 2: Drop old enums
DROP TYPE IF EXISTS "candidate_source";
DROP TYPE IF EXISTS "contact_source";
DROP TYPE IF EXISTS "scrape_status";

-- Step 3: Recreate candidates table with new schema
CREATE TABLE "candidates" (
  "id" text PRIMARY KEY NOT NULL,
  "linkedin_url" text NOT NULL UNIQUE,
  "linkedin_username" text,
  "linkedin_urn" text,
  "full_name" text,
  "first_name" text,
  "last_name" text,
  "headline" text,
  "summary" text,
  "photo_url" text,
  "location" text,
  "location_text" text,
  "email" text,
  "is_premium" boolean DEFAULT false,
  "follower_count" integer,
  "connection_count" integer,
  "experiences" text,
  "educations" text,
  "skills" text,
  "source_data" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Step 4: Recreate search_candidates table
CREATE TABLE "search_candidates" (
  "id" text PRIMARY KEY NOT NULL,
  "search_id" text NOT NULL REFERENCES "search"("id") ON DELETE CASCADE,
  "candidate_id" text NOT NULL REFERENCES "candidates"("id") ON DELETE CASCADE,
  "match_score" integer,
  "notes" text,
  "status" "candidate_status" DEFAULT 'new',
  "source_provider" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "search_candidates_search_id_candidate_id_unique" UNIQUE("search_id", "candidate_id")
);
