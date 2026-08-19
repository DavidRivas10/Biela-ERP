import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { AuthorizedRequest } from "../auth/interfaces/authorization-user";
import { ListSalesQueryDto } from "./dto/list-sales-query.dto";
import { CreateSaleDto, UpdateSaleDto } from "./dto/sale.dto";
import { SalesService } from "./sales.service";

@ApiTags("sales")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller("sales")
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.SALES_CREATE)
  @ApiOperation({
    summary: "Create a registered-customer or walk-in DRAFT Sale",
    description:
      "Inventory is unchanged. Prices are exact-decimal immutable line snapshots.",
  })
  create(@Body() dto: CreateSaleDto, @Req() request: AuthorizedRequest) {
    return this.sales.create(dto, request.user.id);
  }

  @Get()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: "List and filter Sales deterministically" })
  findAll(@Query() query: ListSalesQueryDto) {
    return this.sales.findAll(query);
  }

  @Get(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.SALES_READ)
  @ApiOperation({
    summary: "Get Sale detail, returned/net quantities, and OUT traceability",
  })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.sales.findOne(id);
  }

  @Patch(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.SALES_UPDATE)
  @ApiOperation({ summary: "Edit and fully reprice a DRAFT Sale" })
  @ApiConflictResponse({ description: "Sale is no longer editable" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateSaleDto) {
    return this.sales.update(id, dto);
  }

  @Post(":id/post")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.SALES_POST)
  @ApiOperation({
    summary: "Atomically post an immutable Sale and Inventory OUT movements",
    description:
      "All lines commit together. Insufficient stock, duplicate posting, or inactive references return a conflict without partial effects.",
  })
  @ApiConflictResponse({
    description: "Lifecycle, concurrent posting, or Inventory conflict",
  })
  post(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthorizedRequest,
  ) {
    return this.sales.post(id, request.user.id);
  }

  @Post(":id/cancel")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.SALES_UPDATE)
  @ApiOperation({ summary: "Cancel a DRAFT Sale without Inventory effects" })
  @ApiConflictResponse({ description: "Only a DRAFT Sale can be cancelled" })
  cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthorizedRequest,
  ) {
    return this.sales.cancel(id, request.user.id);
  }
}
