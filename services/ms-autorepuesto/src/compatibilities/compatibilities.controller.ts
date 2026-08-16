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
import { CompatibilitiesService } from "./compatibilities.service";
import {
  CreateCompatibilityDto,
  UpdateCompatibilityDto,
} from "./dto/compatibility.dto";
import {
  ListCompatibilitiesQueryDto,
  NestedCompatibilityQueryDto,
} from "./dto/list-compatibilities-query.dto";

@ApiTags("compatibilities")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller()
export class CompatibilitiesController {
  constructor(private readonly compatibilities: CompatibilitiesService) {}

  @Post("compatibilities")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.COMPATIBILITIES_MANAGE)
  @ApiOperation({
    summary: "Create a deterministic product-to-vehicle compatibility",
  })
  @ApiConflictResponse({
    description: "Product and vehicle are already linked",
  })
  create(@Body() dto: CreateCompatibilityDto) {
    return this.compatibilities.create(dto);
  }

  @Get("compatibilities")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.COMPATIBILITIES_READ)
  @ApiOperation({ summary: "List and filter compatibilities with pagination" })
  findAll(@Query() query: ListCompatibilitiesQueryDto) {
    return this.compatibilities.findAll(query);
  }

  @Get("compatibilities/:id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.COMPATIBILITIES_READ)
  @ApiOperation({ summary: "Get a compatibility" })
  @ApiNotFoundResponse({ description: "Compatibility not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.compatibilities.findOne(id);
  }

  @Patch("compatibilities/:id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.COMPATIBILITIES_MANAGE)
  @ApiOperation({ summary: "Update compatibility notes or active state" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompatibilityDto,
  ) {
    return this.compatibilities.update(id, dto);
  }

  @Get("products/:id/vehicles")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.COMPATIBILITIES_READ)
  @ApiOperation({ summary: "List vehicles compatible with a product" })
  compatibleVehicles(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: NestedCompatibilityQueryDto,
  ) {
    return this.compatibilities.compatibleVehicles(id, query);
  }

  @Get("vehicles/:id/products")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.COMPATIBILITIES_READ)
  @ApiOperation({ summary: "List products compatible with a vehicle" })
  compatibleProducts(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: NestedCompatibilityQueryDto,
  ) {
    return this.compatibilities.compatibleProducts(id, query);
  }
}
