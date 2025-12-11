ALTER TABLE "candidates" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX "embedding_idx" ON "candidates" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "search_name_idx" ON "search" USING gin ("name" gin_trgm_ops);