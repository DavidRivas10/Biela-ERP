import { Module } from "@nestjs/common";
import { InventoryController } from "./inventory.controller";
import { LocationsController } from "./locations.controller";
import { SearchController } from "./search.controller";

@Module({
  controllers: [LocationsController, InventoryController, SearchController],
})
export class OperationsModule {}
