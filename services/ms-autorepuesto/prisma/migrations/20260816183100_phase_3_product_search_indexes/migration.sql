-- Support the Phase 3 case-insensitive partial code and name search patterns.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Product_code_trgm_idx"
ON "Product" USING GIN ("code" gin_trgm_ops);

CREATE INDEX "Product_name_trgm_idx"
ON "Product" USING GIN ("name" gin_trgm_ops);
