import { Module } from "@nestjs/common";
import { PurchasesController } from "./purchases.controller";
import { SuppliersController } from "./suppliers.controller";

@Module({ controllers: [SuppliersController, PurchasesController] })
export class PurchasingModule {}
