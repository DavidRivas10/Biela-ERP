import { Module } from "@nestjs/common";
import { CompatibilitiesController } from "./compatibilities.controller";
import { CompatibilitiesService } from "./compatibilities.service";

@Module({
  controllers: [CompatibilitiesController],
  providers: [CompatibilitiesService],
})
export class CompatibilitiesModule {}
