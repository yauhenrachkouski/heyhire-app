CREATE INDEX "credit_transactions_organization_created_idx" ON "credit_transactions" USING btree ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "search_organization_created_idx" ON "search" USING btree ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "search_candidate_strategies_strategy_idx" ON "search_candidate_strategies" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "search_candidates_search_created_idx" ON "search_candidates" USING btree ("search_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "search_candidates_search_score_idx" ON "search_candidates" USING btree ("search_id","match_score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sourcing_strategies_search_idx" ON "sourcing_strategies" USING btree ("search_id");