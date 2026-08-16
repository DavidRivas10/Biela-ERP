import { Module } from "@nestjs/common";
import { CompatibilitiesController } from "./compatibilities.controller";
import { ProductsController } from "./products.controller";
import { VehiclesController } from "./vehicles.controller";

@Module({
  controllers: [
    ProductsController,
    VehiclesController,
    CompatibilitiesController,
  ],
})
export class CatalogModule {}
