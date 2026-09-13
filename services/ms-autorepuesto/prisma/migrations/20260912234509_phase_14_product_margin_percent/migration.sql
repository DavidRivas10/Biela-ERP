-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "marginPercent" DECIMAL(7,4);

-- NOTE: `prisma migrate dev` wanted to DROP "Product_code_trgm_idx" and
-- "Product_name_trgm_idx" here. Those two GIN/pg_trgm indexes (created by
-- the raw-SQL migration 20260816183100_phase_3_product_search_indexes)
-- back the case-insensitive partial code/name search and are NOT declared
-- in schema.prisma (Prisma's schema DSL in this project's Prisma version
-- has no first-class way to express a gin_trgm_ops operator class), so
-- Prisma's diff engine always sees them as drift and will propose dropping
-- them again on every future migration. Deliberately NOT dropping them
-- here — if a future migration's generated SQL includes a DropIndex for
-- either, remove it the same way before applying, and recreate them
-- manually if they're ever actually dropped:
--   CREATE INDEX "Product_code_trgm_idx" ON "Product" USING GIN ("code" gin_trgm_ops);
--   CREATE INDEX "Product_name_trgm_idx" ON "Product" USING GIN ("name" gin_trgm_ops);

-- RenameIndex
ALTER INDEX "PurchaseReturnItem_purchaseReturnId_purchaseItemId_sourceLocati" RENAME TO "PurchaseReturnItem_purchaseReturnId_purchaseItemId_sourceLo_key";

-- RenameIndex
ALTER INDEX "SaleReturnItem_saleReturnId_saleItemId_destinationLocationId_ke" RENAME TO "SaleReturnItem_saleReturnId_saleItemId_destinationLocationI_key";
