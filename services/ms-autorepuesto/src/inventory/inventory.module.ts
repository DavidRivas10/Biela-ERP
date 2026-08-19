import { Module } from "@nestjs/common";
import {
  InventoryController,
  NestedInventoryController,
} from "./inventory.controller";
import { InventoryService } from "./inventory.service";

@Module({
  controllers: [InventoryController, NestedInventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
