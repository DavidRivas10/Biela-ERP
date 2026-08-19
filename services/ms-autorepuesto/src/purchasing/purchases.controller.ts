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
import { ListPurchasesQueryDto } from "./dto/list-purchases-query.dto";
import { CreatePurchaseDto, UpdatePurchaseDto } from "./dto/purchase.dto";
import { PurchasesService } from "./purchases.service";

@ApiTags("purchases")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller("purchases")
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Post()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PURCHASES_CREATE)
  @ApiOperation({
    summary: "Create a DRAFT Purchase atomically with exact-decimal items",
  })
  create(@Body() dto: CreatePurchaseDto, @Req() request: AuthorizedRequest) {
    return this.purchases.create(dto, request.user.id);
  }

  @Get()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PURCHASES_READ)
  @ApiOperation({ summary: "List and filter Purchases" })
  findAll(@Query() query: ListPurchasesQueryDto) {
    return this.purchases.findAll(query);
  }

  @Get(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PURCHASES_READ)
  @ApiOperation({
    summary: "Get Purchase detail with received, returned, and remaining units",
  })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.purchases.findOne(id);
  }

  @Patch(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PURCHASES_UPDATE)
  @ApiOperation({ summary: "Edit a DRAFT Purchase" })
  @ApiConflictResponse({ description: "Purchase is no longer editable" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseDto,
  ) {
    return this.purchases.update(id, dto);
  }

  @Post(":id/confirm")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PURCHASES_UPDATE)
  @ApiOperation({
    summary: "Confirm a Purchase without changing Inventory",
  })
  @ApiConflictResponse({ description: "Invalid Purchase lifecycle transition" })
  confirm(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthorizedRequest,
  ) {
    return this.purchases.confirm(id, request.user.id);
  }

  @Post(":id/cancel")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PURCHASES_UPDATE)
  @ApiOperation({ summary: "Cancel a DRAFT or unreceived CONFIRMED Purchase" })
  @ApiConflictResponse({ description: "Purchase has posted receiving" })
  cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthorizedRequest,
  ) {
    return this.purchases.cancel(id, request.user.id);
  }
}
