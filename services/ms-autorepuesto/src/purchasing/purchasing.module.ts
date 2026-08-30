import { Module } from "@nestjs/common";
import { FilesModule } from "../files/files.module";
import { InventoryModule } from "../inventory/inventory.module";
import { PurchaseAttachmentsController } from "./purchase-attachments.controller";
import { PurchaseAttachmentsService } from "./purchase-attachments.service";
import { PurchaseReceiptsController } from "./purchase-receipts.controller";
import { PurchaseReceiptsService } from "./purchase-receipts.service";
import { PurchaseReturnsController } from "./purchase-returns.controller";
import { PurchaseReturnsService } from "./purchase-returns.service";
import { PurchasesController } from "./purchases.controller";
import { PurchasesService } from "./purchases.service";
import { FinanceModule } from "../finance/finance.module";

@Module({
  imports: [InventoryModule, FinanceModule, FilesModule],
  controllers: [
    PurchasesController,
    PurchaseReceiptsController,
    PurchaseReturnsController,
    PurchaseAttachmentsController,
  ],
  providers: [
    PurchasesService,
    PurchaseReceiptsService,
    PurchaseReturnsService,
    PurchaseAttachmentsService,
  ],
})
export class PurchasingModule {}
