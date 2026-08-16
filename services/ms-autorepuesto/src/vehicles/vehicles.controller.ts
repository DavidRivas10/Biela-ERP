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
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { BUSINESS_PERMISSIONS } from "../auth/constants/business-permissions";
import { RequireBusinessPermissions } from "../auth/decorators/permissions.decorator";
import { AutorepuestoAuthGuard } from "../auth/guards/autorepuesto-auth.guard";
import { BusinessPermissionsGuard } from "../auth/guards/business-permissions.guard";
import { ListVehiclesQueryDto } from "./dto/list-vehicles-query.dto";
import { CreateVehicleDto, UpdateVehicleDto } from "./dto/vehicle.dto";
import { VehiclesService } from "./vehicles.service";

@ApiTags("vehicles")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller("vehicles")
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Post()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.VEHICLES_CREATE)
  @ApiOperation({ summary: "Create a deterministic vehicle fitment variant" })
  create(@Body() dto: CreateVehicleDto) {
    return this.vehicles.create(dto);
  }

  @Get()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.VEHICLES_READ)
  @ApiOperation({ summary: "List and filter vehicles with pagination" })
  findAll(@Query() query: ListVehiclesQueryDto) {
    return this.vehicles.findAll(query);
  }

  @Get(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.VEHICLES_READ)
  @ApiOperation({ summary: "Get a vehicle" })
  @ApiNotFoundResponse({ description: "Vehicle not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.vehicles.findOne(id);
  }

  @Patch(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.VEHICLES_UPDATE)
  @ApiOperation({ summary: "Update a vehicle fitment variant" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehicles.update(id, dto);
  }

  @Patch(":id/activate")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.VEHICLES_UPDATE)
  @ApiOperation({ summary: "Activate a vehicle" })
  activate(@Param("id", ParseUUIDPipe) id: string) {
    return this.vehicles.setActive(id, true);
  }

  @Patch(":id/deactivate")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.VEHICLES_UPDATE)
  @ApiOperation({ summary: "Deactivate a vehicle" })
  deactivate(@Param("id", ParseUUIDPipe) id: string) {
    return this.vehicles.setActive(id, false);
  }
}
