-- CreateEnum
CREATE TYPE "InventoryMovementReferenceType" AS ENUM ('PURCHASE_RECEIPT', 'PURCHASE_RETURN');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchasingDocumentStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- Extend the existing InventoryMovement ledger with controlled commercial references.
ALTER TABLE "InventoryMovement"
ADD COLUMN "referenceType" "InventoryMovementReferenceType",
ADD COLUMN "referenceId" UUID,
ADD COLUMN "referenceItemId" UUID;

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "businessName" VARCHAR(160) NOT NULL,
    "taxId" VARCHAR(40),
    "contactName" VARCHAR(120),
    "phone" VARCHAR(40),
    "email" VARCHAR(160),
    "address" VARCHAR(500),
    "notes" VARCHAR(1000),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "supplierId" UUID NOT NULL,
    "supplierDocumentNumber" VARCHAR(80),
    "documentDate" DATE NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" VARCHAR(1000),
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdByActorId" VARCHAR(120) NOT NULL,
    "confirmedByActorId" VARCHAR(120),
    "confirmedAt" TIMESTAMP(3),
    "cancelledByActorId" VARCHAR(120),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "orderedQuantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lineSubtotal" DECIMAL(18,2) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReceipt" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "purchaseId" UUID NOT NULL,
    "destinationLocationId" UUID NOT NULL,
    "status" "PurchasingDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "receivedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "createdByActorId" VARCHAR(120) NOT NULL,
    "postedByActorId" VARCHAR(120),
    "notes" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReceiptItem" (
    "id" UUID NOT NULL,
    "receiptId" UUID NOT NULL,
    "purchaseItemId" UUID NOT NULL,
    "quantityReceived" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReturn" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "purchaseId" UUID NOT NULL,
    "status" "PurchasingDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" VARCHAR(500) NOT NULL,
    "postedAt" TIMESTAMP(3),
    "createdByActorId" VARCHAR(120) NOT NULL,
    "postedByActorId" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReturnItem" (
    "id" UUID NOT NULL,
    "purchaseReturnId" UUID NOT NULL,
    "purchaseItemId" UUID NOT NULL,
    "sourceLocationId" UUID NOT NULL,
    "quantityReturned" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseReturnItem_pkey" PRIMARY KEY ("id")
);

-- Critical commercial and stock-reference constraints.
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_money_check" CHECK (
    "subtotal" >= 0 AND "discountTotal" >= 0 AND "taxTotal" >= 0 AND
    "discountTotal" <= "subtotal" AND
    "total" = "subtotal" - "discountTotal" + "taxTotal"
);
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_quantity_check" CHECK ("orderedQuantity" > 0);
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_money_check" CHECK (
    "unitCost" >= 0 AND "discountAmount" >= 0 AND "taxAmount" >= 0 AND
    "lineSubtotal" >= 0 AND "discountAmount" <= "lineSubtotal" AND
    "lineTotal" = "lineSubtotal" - "discountAmount" + "taxAmount"
);
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_quantity_check" CHECK ("quantityReceived" > 0);
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_quantity_check" CHECK ("quantityReturned" > 0);
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_commercial_reference_check" CHECK (
    ("referenceType" IS NULL AND "referenceId" IS NULL AND "referenceItemId" IS NULL)
    OR
    ("referenceType" IS NOT NULL AND "referenceId" IS NOT NULL AND "referenceItemId" IS NOT NULL)
);
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_commercial_type_check" CHECK (
    "referenceType" IS NULL
    OR ("referenceType" = 'PURCHASE_RECEIPT' AND "type" = 'IN')
    OR ("referenceType" = 'PURCHASE_RETURN' AND "type" = 'OUT')
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");
CREATE INDEX "Supplier_businessName_idx" ON "Supplier"("businessName");
CREATE INDEX "Supplier_active_idx" ON "Supplier"("active");
CREATE UNIQUE INDEX "Purchase_number_key" ON "Purchase"("number");
CREATE INDEX "Purchase_supplierId_documentDate_idx" ON "Purchase"("supplierId", "documentDate");
CREATE INDEX "Purchase_status_documentDate_idx" ON "Purchase"("status", "documentDate");
CREATE INDEX "Purchase_supplierDocumentNumber_idx" ON "Purchase"("supplierDocumentNumber");
CREATE UNIQUE INDEX "PurchaseItem_purchaseId_productId_key" ON "PurchaseItem"("purchaseId", "productId");
CREATE INDEX "PurchaseItem_productId_idx" ON "PurchaseItem"("productId");
CREATE UNIQUE INDEX "PurchaseReceipt_number_key" ON "PurchaseReceipt"("number");
CREATE INDEX "PurchaseReceipt_purchaseId_createdAt_idx" ON "PurchaseReceipt"("purchaseId", "createdAt");
CREATE INDEX "PurchaseReceipt_destinationLocationId_idx" ON "PurchaseReceipt"("destinationLocationId");
CREATE INDEX "PurchaseReceipt_status_idx" ON "PurchaseReceipt"("status");
CREATE UNIQUE INDEX "PurchaseReceiptItem_receiptId_purchaseItemId_key" ON "PurchaseReceiptItem"("receiptId", "purchaseItemId");
CREATE INDEX "PurchaseReceiptItem_purchaseItemId_idx" ON "PurchaseReceiptItem"("purchaseItemId");
CREATE UNIQUE INDEX "PurchaseReturn_number_key" ON "PurchaseReturn"("number");
CREATE INDEX "PurchaseReturn_purchaseId_createdAt_idx" ON "PurchaseReturn"("purchaseId", "createdAt");
CREATE INDEX "PurchaseReturn_status_idx" ON "PurchaseReturn"("status");
CREATE UNIQUE INDEX "PurchaseReturnItem_purchaseReturnId_purchaseItemId_sourceLocationId_key" ON "PurchaseReturnItem"("purchaseReturnId", "purchaseItemId", "sourceLocationId");
CREATE INDEX "PurchaseReturnItem_purchaseItemId_idx" ON "PurchaseReturnItem"("purchaseItemId");
CREATE INDEX "PurchaseReturnItem_sourceLocationId_idx" ON "PurchaseReturnItem"("sourceLocationId");
CREATE INDEX "InventoryMovement_referenceType_referenceId_idx" ON "InventoryMovement"("referenceType", "referenceId");
CREATE UNIQUE INDEX "InventoryMovement_referenceType_referenceItemId_key" ON "InventoryMovement"("referenceType", "referenceItemId");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_purchaseReturnId_fkey" FOREIGN KEY ("purchaseReturnId") REFERENCES "PurchaseReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
