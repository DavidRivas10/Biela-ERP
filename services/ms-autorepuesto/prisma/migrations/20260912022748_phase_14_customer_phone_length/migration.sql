-- Phase 14 (product/UX redesign): the Customer phone field was too short for
-- a shop that gives two numbers ("9999-9999 / 8888-8888") or one with an
-- extension. Widens VARCHAR(40) to VARCHAR(60); additive, no data loss.
ALTER TABLE "Customer" ALTER COLUMN "phone" TYPE VARCHAR(60);
