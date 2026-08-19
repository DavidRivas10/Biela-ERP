-- Extend the controlled commercial reference enum without editing Phase 5.
ALTER TABLE "InventoryMovement" DROP CONSTRAINT "InventoryMovement_commercial_type_check";
ALTER TYPE "InventoryMovementReferenceType" RENAME TO "InventoryMovementReferenceType_old";
CREATE TYPE "InventoryMovementReferenceType" AS ENUM (
    'PURCHASE_RECEIPT',
    'PURCHASE_RETURN',
    'SALE',
    'SALE_RETURN'
);
ALTER TABLE "InventoryMovement"
ALTER COLUMN "referenceType" TYPE "InventoryMovementReferenceType"
USING ("referenceType"::text::"InventoryMovementReferenceType");
DROP TYPE "InventoryMovementReferenceType_old";

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- Add the current suggested price only; historical truth belongs to SaleItem.
ALTER TABLE "Product" ADD COLUMN "defaultSalePrice" DECIMAL(18,4);
ALTER TABLE "Product" ADD CONSTRAINT "Product_defaultSalePrice_check"
CHECK ("defaultSalePrice" IS NULL OR "defaultSalePrice" >= 0);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "businessName" VARCHAR(160),
    "taxId" VARCHAR(40),
    "contactName" VARCHAR(120),
    "phone" VARCHAR(40),
    "email" VARCHAR(160),
    "address" VARCHAR(500),
    "notes" VARCHAR(1000),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Sale" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "customerId" UUID,
    "documentDate" DATE NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" VARCHAR(1000),
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdByActorId" VARCHAR(120) NOT NULL,
    "postedByActorId" VARCHAR(120),
    "postedAt" TIMESTAMP(3),
    "cancelledByActorId" VARCHAR(120),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaleItem" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "sourceLocationId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lineSubtotal" DECIMAL(18,2) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaleReturn" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "saleId" UUID NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" VARCHAR(500) NOT NULL,
    "createdByActorId" VARCHAR(120) NOT NULL,
    "postedByActorId" VARCHAR(120),
    "postedAt" TIMESTAMP(3),
    "cancelledByActorId" VARCHAR(120),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SaleReturn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaleReturnItem" (
    "id" UUID NOT NULL,
    "saleReturnId" UUID NOT NULL,
    "saleItemId" UUID NOT NULL,
    "destinationLocationId" UUID NOT NULL,
    "quantityReturned" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleReturnItem_pkey" PRIMARY KEY ("id")
);

-- Database-enforced commercial invariants.
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_money_check" CHECK (
    "subtotal" >= 0 AND "discountTotal" >= 0 AND "taxTotal" >= 0 AND
    "discountTotal" <= "subtotal" AND
    "total" = "subtotal" - "discountTotal" + "taxTotal"
);
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_money_check" CHECK (
    "unitPrice" >= 0 AND "discountAmount" >= 0 AND "taxAmount" >= 0 AND
    "lineSubtotal" >= 0 AND "discountAmount" <= "lineSubtotal" AND
    "lineTotal" = "lineSubtotal" - "discountAmount" + "taxAmount"
);
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_quantity_check"
CHECK ("quantityReturned" > 0);
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_commercial_type_check" CHECK (
    "referenceType" IS NULL
    OR ("referenceType" = 'PURCHASE_RECEIPT' AND "type" = 'IN')
    OR ("referenceType" = 'PURCHASE_RETURN' AND "type" = 'OUT')
    OR ("referenceType" = 'SALE' AND "type" = 'OUT')
    OR ("referenceType" = 'SALE_RETURN' AND "type" = 'IN')
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");
CREATE INDEX "Customer_name_idx" ON "Customer"("name");
CREATE INDEX "Customer_businessName_idx" ON "Customer"("businessName");
CREATE INDEX "Customer_taxId_idx" ON "Customer"("taxId");
CREATE INDEX "Customer_active_idx" ON "Customer"("active");
CREATE UNIQUE INDEX "Sale_number_key" ON "Sale"("number");
CREATE INDEX "Sale_customerId_documentDate_idx" ON "Sale"("customerId", "documentDate");
CREATE INDEX "Sale_status_documentDate_idx" ON "Sale"("status", "documentDate");
CREATE INDEX "Sale_documentDate_idx" ON "Sale"("documentDate");
CREATE UNIQUE INDEX "SaleItem_saleId_productId_sourceLocationId_key" ON "SaleItem"("saleId", "productId", "sourceLocationId");
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");
CREATE INDEX "SaleItem_sourceLocationId_idx" ON "SaleItem"("sourceLocationId");
CREATE UNIQUE INDEX "SaleReturn_number_key" ON "SaleReturn"("number");
CREATE INDEX "SaleReturn_saleId_createdAt_idx" ON "SaleReturn"("saleId", "createdAt");
CREATE INDEX "SaleReturn_status_createdAt_idx" ON "SaleReturn"("status", "createdAt");
CREATE UNIQUE INDEX "SaleReturnItem_saleReturnId_saleItemId_destinationLocationId_key" ON "SaleReturnItem"("saleReturnId", "saleItemId", "destinationLocationId");
CREATE INDEX "SaleReturnItem_saleItemId_idx" ON "SaleReturnItem"("saleItemId");
CREATE INDEX "SaleReturnItem_destinationLocationId_idx" ON "SaleReturnItem"("destinationLocationId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES "SaleReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
