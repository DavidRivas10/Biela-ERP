import { Module } from "@nestjs/common";
import {
  VehicleBrandsController,
  VehicleModelsController,
} from "./vehicle-catalogs.controller";
import { VehicleCatalogsService } from "./vehicle-catalogs.service";
import { VehiclesController } from "./vehicles.controller";
import { VehiclesService } from "./vehicles.service";

@Module({
  controllers: [
    VehiclesController,
    VehicleBrandsController,
    VehicleModelsController,
  ],
  providers: [VehiclesService, VehicleCatalogsService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
