import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { PurchaseReceiptsController } from "./purchase-receipts.controller";
import { PurchaseReceiptsService } from "./purchase-receipts.service";
import { PurchaseReturnsController } from "./purchase-returns.controller";
import { PurchaseReturnsService } from "./purchase-returns.service";
import { PurchasesController } from "./purchases.controller";
import { PurchasesService } from "./purchases.service";

@Module({
  imports: [InventoryModule],
  controllers: [
    PurchasesController,
    PurchaseReceiptsController,
    PurchaseReturnsController,
  ],
  providers: [
    PurchasesService,
    PurchaseReceiptsService,
    PurchaseReturnsService,
  ],
})
export class PurchasingModule {}
