-- Phase 14 (product/UX redesign): optional free-text label for a Sale used
-- when it is run as an "open account" (cuenta abierta) at the counter, e.g.
-- "Corolla azul - Juan". Additive and nullable; existing sales keep NULL and
-- behave exactly as before (walk-in or registered-customer sale). The Sale
-- number still serves as the automatic account number.
ALTER TABLE "Sale" ADD COLUMN "accountLabel" VARCHAR(120);
