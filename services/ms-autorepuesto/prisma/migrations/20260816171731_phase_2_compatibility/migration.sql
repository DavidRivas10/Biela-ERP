-- CreateTable
CREATE TABLE "ProductCompatibility" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "notes" VARCHAR(500),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductCompatibility_productId_idx" ON "ProductCompatibility"("productId");

-- CreateIndex
CREATE INDEX "ProductCompatibility_vehicleId_idx" ON "ProductCompatibility"("vehicleId");

-- CreateIndex
CREATE INDEX "ProductCompatibility_active_idx" ON "ProductCompatibility"("active");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCompatibility_productId_vehicleId_key" ON "ProductCompatibility"("productId", "vehicleId");

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
