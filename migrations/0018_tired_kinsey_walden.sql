CREATE TABLE "search_candidate_strategies" (
	"id" text PRIMARY KEY NOT NULL,
	"search_candidate_id" text NOT NULL,
	"strategy_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "search_candidate_strategies_search_candidate_id_strategy_id_unique" UNIQUE("search_candidate_id","strategy_id")
);
--> statement-breakpoint
ALTER TABLE "search_candidate_strategies" ADD CONSTRAINT "search_candidate_strategies_search_candidate_id_search_candidates_id_fk" FOREIGN KEY ("search_candidate_id") REFERENCES "public"."search_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_candidate_strategies" ADD CONSTRAINT "search_candidate_strategies_strategy_id_sourcing_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."sourcing_strategies"("id") ON DELETE cascade ON UPDATE no action;