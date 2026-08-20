-- CreateEnum
CREATE TYPE "PaymentMethodKind" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'OTHER');
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "PaymentType" AS ENUM ('SALE_PAYMENT', 'SALE_REFUND');
CREATE TYPE "PaymentStatus" AS ENUM ('POSTED', 'REVERSED');
CREATE TYPE "CashMovementType" AS ENUM (
    'SALE_PAYMENT',
    'SALE_PAYMENT_REVERSAL',
    'SALE_REFUND',
    'SALE_REFUND_REVERSAL',
    'MANUAL_IN',
    'MANUAL_OUT'
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "kind" "PaymentMethodKind" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashRegister" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CashRegister_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashSession" (
    "id" UUID NOT NULL,
    "cashRegisterId" UUID NOT NULL,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openingAmount" DECIMAL(18,2) NOT NULL,
    "openedByActorId" VARCHAR(120) NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingNotes" VARCHAR(500),
    "closedByActorId" VARCHAR(120),
    "closedAt" TIMESTAMP(3),
    "expectedAmount" DECIMAL(18,2),
    "countedAmount" DECIMAL(18,2),
    "differenceAmount" DECIMAL(18,2),
    "closingNotes" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "type" "PaymentType" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'POSTED',
    "saleId" UUID NOT NULL,
    "saleReturnId" UUID,
    "paymentMethodId" UUID NOT NULL,
    "cashSessionId" UUID,
    "amount" DECIMAL(18,2) NOT NULL,
    "tenderedAmount" DECIMAL(18,2),
    "changeAmount" DECIMAL(18,2),
    "externalReference" VARCHAR(160),
    "notes" VARCHAR(500),
    "createdByActorId" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedByActorId" VARCHAR(120),
    "reversalReason" VARCHAR(500),
    "reversalCashSessionId" UUID,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashMovement" (
    "id" UUID NOT NULL,
    "cashSessionId" UUID NOT NULL,
    "paymentId" UUID,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" VARCHAR(500),
    "actorId" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- Critical exact-money and lifecycle constraints.
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_state_check" CHECK (
    "openingAmount" >= 0 AND
    (
      ("status" = 'OPEN' AND "closedByActorId" IS NULL AND "closedAt" IS NULL
       AND "expectedAmount" IS NULL AND "countedAmount" IS NULL
       AND "differenceAmount" IS NULL)
      OR
      ("status" = 'CLOSED' AND "closedByActorId" IS NOT NULL AND "closedAt" IS NOT NULL
       AND "expectedAmount" IS NOT NULL AND "expectedAmount" >= 0
       AND "countedAmount" IS NOT NULL AND "countedAmount" >= 0
       AND "differenceAmount" = "countedAmount" - "expectedAmount"
       AND ("differenceAmount" = 0 OR LENGTH(TRIM("closingNotes")) > 0))
    )
);

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reference_check" CHECK (
    ("type" = 'SALE_PAYMENT' AND "saleReturnId" IS NULL)
    OR ("type" = 'SALE_REFUND' AND "saleReturnId" IS NOT NULL)
);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_money_check" CHECK (
    "amount" > 0 AND
    (
      ("tenderedAmount" IS NULL AND "changeAmount" IS NULL)
      OR
      ("tenderedAmount" IS NOT NULL AND "changeAmount" IS NOT NULL
       AND "tenderedAmount" >= "amount" AND "changeAmount" >= 0
       AND "changeAmount" = "tenderedAmount" - "amount")
    )
);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversal_state_check" CHECK (
    ("status" = 'POSTED' AND "reversedAt" IS NULL AND "reversedByActorId" IS NULL
     AND "reversalReason" IS NULL AND "reversalCashSessionId" IS NULL)
    OR
    ("status" = 'REVERSED' AND "reversedAt" IS NOT NULL
     AND "reversedByActorId" IS NOT NULL
     AND LENGTH(TRIM("reversalReason")) > 0)
);
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_shape_check" CHECK (
    "amount" > 0 AND
    (
      ("type" IN ('MANUAL_IN', 'MANUAL_OUT') AND "paymentId" IS NULL
       AND LENGTH(TRIM("reason")) > 0)
      OR
      ("type" IN ('SALE_PAYMENT', 'SALE_PAYMENT_REVERSAL', 'SALE_REFUND', 'SALE_REFUND_REVERSAL')
       AND "paymentId" IS NOT NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_code_key" ON "PaymentMethod"("code");
CREATE INDEX "PaymentMethod_kind_active_idx" ON "PaymentMethod"("kind", "active");
CREATE INDEX "PaymentMethod_active_idx" ON "PaymentMethod"("active");
CREATE UNIQUE INDEX "CashRegister_code_key" ON "CashRegister"("code");
CREATE INDEX "CashRegister_active_idx" ON "CashRegister"("active");
CREATE INDEX "CashSession_cashRegisterId_openedAt_idx" ON "CashSession"("cashRegisterId", "openedAt");
CREATE INDEX "CashSession_status_openedAt_idx" ON "CashSession"("status", "openedAt");
CREATE INDEX "CashSession_openedByActorId_openedAt_idx" ON "CashSession"("openedByActorId", "openedAt");
CREATE UNIQUE INDEX "CashSession_one_open_per_register_key"
ON "CashSession"("cashRegisterId") WHERE "status" = 'OPEN';
CREATE UNIQUE INDEX "Payment_number_key" ON "Payment"("number");
CREATE INDEX "Payment_saleId_type_status_createdAt_idx" ON "Payment"("saleId", "type", "status", "createdAt");
CREATE INDEX "Payment_saleReturnId_status_createdAt_idx" ON "Payment"("saleReturnId", "status", "createdAt");
CREATE INDEX "Payment_paymentMethodId_createdAt_idx" ON "Payment"("paymentMethodId", "createdAt");
CREATE INDEX "Payment_cashSessionId_createdAt_idx" ON "Payment"("cashSessionId", "createdAt");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
CREATE UNIQUE INDEX "CashMovement_paymentId_type_key" ON "CashMovement"("paymentId", "type");
CREATE INDEX "CashMovement_cashSessionId_createdAt_idx" ON "CashMovement"("cashSessionId", "createdAt");
CREATE INDEX "CashMovement_paymentId_idx" ON "CashMovement"("paymentId");
CREATE INDEX "CashMovement_type_createdAt_idx" ON "CashMovement"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "CashRegister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES "SaleReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversalCashSessionId_fkey" FOREIGN KEY ("reversalCashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
