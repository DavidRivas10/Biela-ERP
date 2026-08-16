import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { BUSINESS_PERMISSIONS } from "../auth/constants/business-permissions";
import { RequireBusinessPermissions } from "../auth/decorators/permissions.decorator";
import { AutorepuestoAuthGuard } from "../auth/guards/autorepuesto-auth.guard";
import { BusinessPermissionsGuard } from "../auth/guards/business-permissions.guard";
import {
  CreateVehicleBrandDto,
  CreateVehicleModelDto,
  ListVehicleModelsQueryDto,
  UpdateVehicleBrandDto,
  UpdateVehicleModelDto,
} from "./dto/vehicle-catalog.dto";
import { VehicleCatalogsService } from "./vehicle-catalogs.service";

@ApiTags("vehicle-brands")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller("vehicle-brands")
export class VehicleBrandsController {
  constructor(private readonly catalogs: VehicleCatalogsService) {}

  @Post()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.VEHICLES_CREATE)
  @ApiOperation({ summary: "Create a vehicle brand" })
  create(@Body() dto: CreateVehicleBrandDto) {
    return this.catalogs.createBrand(dto);
  }

  @Get()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.VEHICLES_READ)
  @ApiOperation({ summary: "List vehicle brands" })
  findAll() {
    return this.catalogs.listBrands();
  }

  @Patch(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.VEHICLES_UPDATE)
  @ApiOperation({ summary: "Update a vehicle brand" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleBrandDto,
  ) {
    return this.catalogs.updateBrand(id, dto);
  }
}

@ApiTags("vehicle-models")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller("vehicle-models")
export class VehicleModelsController {
  constructor(private readonly catalogs: VehicleCatalogsService) {}

  @Post()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.VEHICLES_CREATE)
  @ApiOperation({ summary: "Create a model belonging to a vehicle brand" })
  create(@Body() dto: CreateVehicleModelDto) {
    return this.catalogs.createModel(dto);
  }

  @Get()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.VEHICLES_READ)
  @ApiQuery({ name: "brandId", required: false, format: "uuid" })
  @ApiOperation({ summary: "List vehicle models, optionally by brand" })
  findAll(@Query() query: ListVehicleModelsQueryDto) {
    return this.catalogs.listModels(query.brandId);
  }

  @Patch(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.VEHICLES_UPDATE)
  @ApiOperation({ summary: "Update a vehicle model" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleModelDto,
  ) {
    return this.catalogs.updateModel(id, dto);
  }
}
