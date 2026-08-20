import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { FinanceModule } from "../finance/finance.module";
import { SaleReturnsController } from "./sale-returns.controller";
import { SaleReturnsService } from "./sale-returns.service";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";

@Module({
  imports: [InventoryModule, FinanceModule],
  controllers: [SalesController, SaleReturnsController],
  providers: [SalesService, SaleReturnsService],
})
export class SalesModule {}
