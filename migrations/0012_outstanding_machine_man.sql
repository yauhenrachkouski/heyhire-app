CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "search_name_idx" ON "search" USING gin ("name" gin_trgm_ops);