-- Keep all persisted inventory balances non-negative even outside the API.
ALTER TABLE "Inventory"
ADD CONSTRAINT "Inventory_quantity_check" CHECK ("quantity" >= 0);

-- ADJUSTMENT stores a non-negative target balance. Other commands move units.
ALTER TABLE "InventoryMovement"
ADD CONSTRAINT "InventoryMovement_quantity_check" CHECK (
  ("type" = 'ADJUSTMENT' AND "quantity" >= 0)
  OR ("type" <> 'ADJUSTMENT' AND "quantity" > 0)
);

-- Persist only the location shape defined for each movement semantic.
ALTER TABLE "InventoryMovement"
ADD CONSTRAINT "InventoryMovement_locations_check" CHECK (
  ("type" IN ('INITIAL', 'IN', 'ADJUSTMENT') AND "sourceLocationId" IS NULL AND "destinationLocationId" IS NOT NULL)
  OR ("type" = 'OUT' AND "sourceLocationId" IS NOT NULL AND "destinationLocationId" IS NULL)
  OR ("type" = 'TRANSFER' AND "sourceLocationId" IS NOT NULL AND "destinationLocationId" IS NOT NULL AND "sourceLocationId" <> "destinationLocationId")
);

ALTER TABLE "InventoryMovement"
ADD CONSTRAINT "InventoryMovement_balances_check" CHECK (
  ("sourceQuantityBefore" IS NULL OR "sourceQuantityBefore" >= 0)
  AND ("sourceQuantityAfter" IS NULL OR "sourceQuantityAfter" >= 0)
  AND ("destinationQuantityBefore" IS NULL OR "destinationQuantityBefore" >= 0)
  AND ("destinationQuantityAfter" IS NULL OR "destinationQuantityAfter" >= 0)
);
