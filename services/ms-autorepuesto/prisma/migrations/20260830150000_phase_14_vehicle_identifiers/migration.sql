-- Phase 14 (product/UX redesign): optional VIN and engine (serial) number for a
-- Vehicle. Complementary identifiers the counter uses to resolve ambiguity when
-- brand + model + year is not enough; they never replace the primary match.
-- Additive and nullable; existing vehicles keep NULL.
ALTER TABLE "Vehicle" ADD COLUMN "vin" VARCHAR(64);
ALTER TABLE "Vehicle" ADD COLUMN "engineNumber" VARCHAR(64);

-- CreateIndex
CREATE INDEX "Vehicle_vin_idx" ON "Vehicle"("vin");

-- CreateIndex
CREATE INDEX "Vehicle_engineNumber_idx" ON "Vehicle"("engineNumber");
