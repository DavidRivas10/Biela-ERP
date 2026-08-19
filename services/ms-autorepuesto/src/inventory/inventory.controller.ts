import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { BUSINESS_PERMISSIONS } from "../auth/constants/business-permissions";
import { RequireBusinessPermissions } from "../auth/decorators/permissions.decorator";
import { AutorepuestoAuthGuard } from "../auth/guards/autorepuesto-auth.guard";
import { BusinessPermissionsGuard } from "../auth/guards/business-permissions.guard";
import { InventoryMovementPermissionsGuard } from "../auth/guards/inventory-movement-permissions.guard";
import { AuthorizedRequest } from "../auth/interfaces/authorization-user";
import { CreateInventoryMovementDto } from "./dto/inventory-movement.dto";
import { ListInventoryMovementsQueryDto } from "./dto/list-inventory-movements-query.dto";
import { ListInventoryQueryDto } from "./dto/list-inventory-query.dto";
import { InventoryService } from "./inventory.service";

@ApiTags("inventory")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Post("movements")
  @UseGuards(InventoryMovementPermissionsGuard)
  @ApiOperation({
    summary: "Apply a traceable stock movement",
    description:
      "ADJUSTMENT sets a target balance and requires a reason. All other movement quantities represent moved units.",
  })
  @ApiConflictResponse({ description: "Insufficient or conflicting stock" })
  createMovement(
    @Body() dto: CreateInventoryMovementDto,
    @Req() request: AuthorizedRequest,
  ) {
    return this.inventory.createMovement(dto, request.user.id);
  }

  @Get("movements")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.INVENTORY_READ)
  @ApiOperation({ summary: "List inventory movement history" })
  findMovements(@Query() query: ListInventoryMovementsQueryDto) {
    return this.inventory.findMovements(query);
  }

  @Get()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.INVENTORY_READ)
  @ApiOperation({ summary: "List stock balances by product and location" })
  findAll(@Query() query: ListInventoryQueryDto) {
    return this.inventory.findAll(query);
  }

  @Get(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.INVENTORY_READ)
  @ApiOperation({ summary: "Get one inventory balance" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.inventory.findOne(id);
  }
}

@ApiTags("inventory")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller()
export class NestedInventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get("products/:id/inventory")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.INVENTORY_READ)
  @ApiOperation({
    summary: "List a product's location balances and total stock",
  })
  productInventory(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: ListInventoryQueryDto,
  ) {
    return this.inventory.findByProduct(id, query);
  }

  @Get("locations/:id/inventory")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.INVENTORY_READ)
  @ApiOperation({ summary: "List products stored at a physical location" })
  locationInventory(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: ListInventoryQueryDto,
  ) {
    return this.inventory.findByLocation(id, query);
  }
}
