-- Phase 14 (product/UX redesign): optional reference cost per product.
-- Additive and nullable; existing rows are unaffected. Used only to show an
-- estimated margin against defaultSalePrice. Historical purchase cost stays on
-- PurchaseItem.unitCost and is untouched.
ALTER TABLE "Product" ADD COLUMN "referenceCost" DECIMAL(18,4);
