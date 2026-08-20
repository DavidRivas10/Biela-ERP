ALTER TABLE "Purchase" ADD COLUMN "paymentDueDate" DATE;
ALTER TABLE "Sale" ADD COLUMN "paymentDueDate" DATE;

ALTER TABLE "Payment" ALTER COLUMN "saleId" DROP NOT NULL;
ALTER TABLE "Payment" ADD COLUMN "purchaseId" UUID;
ALTER TABLE "Payment" ADD COLUMN "purchaseReturnId" UUID;

ALTER TABLE "Payment" DROP CONSTRAINT "Payment_reference_check";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reference_check" CHECK (
  ("type" = 'SALE_PAYMENT' AND "saleId" IS NOT NULL AND "saleReturnId" IS NULL
    AND "purchaseId" IS NULL AND "purchaseReturnId" IS NULL)
  OR
  ("type" = 'SALE_REFUND' AND "saleId" IS NOT NULL AND "saleReturnId" IS NOT NULL
    AND "purchaseId" IS NULL AND "purchaseReturnId" IS NULL)
  OR
  ("type" = 'PURCHASE_PAYMENT' AND "saleId" IS NULL AND "saleReturnId" IS NULL
    AND "purchaseId" IS NOT NULL AND "purchaseReturnId" IS NULL)
  OR
  ("type" = 'SUPPLIER_REFUND' AND "saleId" IS NULL AND "saleReturnId" IS NULL
    AND "purchaseId" IS NOT NULL AND "purchaseReturnId" IS NOT NULL)
);

ALTER TABLE "CashMovement" DROP CONSTRAINT "CashMovement_shape_check";
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_shape_check" CHECK (
  "amount" > 0 AND
  (
    ("type" IN ('MANUAL_IN', 'MANUAL_OUT') AND "paymentId" IS NULL
      AND LENGTH(TRIM("reason")) > 0)
    OR
    ("type" IN (
      'SALE_PAYMENT', 'SALE_PAYMENT_REVERSAL',
      'SALE_REFUND', 'SALE_REFUND_REVERSAL',
      'PURCHASE_PAYMENT', 'PURCHASE_PAYMENT_REVERSAL',
      'SUPPLIER_REFUND', 'SUPPLIER_REFUND_REVERSAL'
    ) AND "paymentId" IS NOT NULL)
  )
);

CREATE INDEX "Purchase_supplierId_paymentDueDate_status_idx"
  ON "Purchase"("supplierId", "paymentDueDate", "status");
CREATE INDEX "Purchase_paymentDueDate_status_idx"
  ON "Purchase"("paymentDueDate", "status");
CREATE INDEX "Sale_customerId_paymentDueDate_status_idx"
  ON "Sale"("customerId", "paymentDueDate", "status");
CREATE INDEX "Sale_paymentDueDate_status_idx"
  ON "Sale"("paymentDueDate", "status");
CREATE INDEX "Payment_purchaseId_type_status_createdAt_idx"
  ON "Payment"("purchaseId", "type", "status", "createdAt");
CREATE INDEX "Payment_purchaseReturnId_status_createdAt_idx"
  ON "Payment"("purchaseReturnId", "status", "createdAt");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_purchaseReturnId_fkey"
  FOREIGN KEY ("purchaseReturnId") REFERENCES "PurchaseReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
