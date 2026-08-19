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
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { BUSINESS_PERMISSIONS } from "../auth/constants/business-permissions";
import { RequireBusinessPermissions } from "../auth/decorators/permissions.decorator";
import { AutorepuestoAuthGuard } from "../auth/guards/autorepuesto-auth.guard";
import { BusinessPermissionsGuard } from "../auth/guards/business-permissions.guard";
import { ListLocationsQueryDto } from "./dto/list-locations-query.dto";
import { CreateLocationDto, UpdateLocationDto } from "./dto/location.dto";
import { LocationsService } from "./locations.service";

@ApiTags("locations")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller("locations")
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Post()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.LOCATIONS_CREATE)
  @ApiOperation({ summary: "Create a physical storage location" })
  @ApiConflictResponse({ description: "Location code already exists" })
  create(@Body() dto: CreateLocationDto) {
    return this.locations.create(dto);
  }

  @Get()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.LOCATIONS_READ)
  @ApiOperation({ summary: "List and filter physical locations" })
  findAll(@Query() query: ListLocationsQueryDto) {
    return this.locations.findAll(query);
  }

  @Get(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.LOCATIONS_READ)
  @ApiOperation({ summary: "Get a physical location" })
  @ApiNotFoundResponse({ description: "Location not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.locations.findOne(id);
  }

  @Patch(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.LOCATIONS_UPDATE)
  @ApiOperation({ summary: "Update a physical location" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.locations.update(id, dto);
  }

  @Patch(":id/activate")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.LOCATIONS_UPDATE)
  @ApiOperation({ summary: "Activate a physical location" })
  activate(@Param("id", ParseUUIDPipe) id: string) {
    return this.locations.setActive(id, true);
  }

  @Patch(":id/deactivate")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.LOCATIONS_UPDATE)
  @ApiOperation({ summary: "Deactivate a physical location" })
  deactivate(@Param("id", ParseUUIDPipe) id: string) {
    return this.locations.setActive(id, false);
  }
}
