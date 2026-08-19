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
import { AuthorizedRequest } from "../auth/interfaces/authorization-user";
import { ListPurchasingDocumentsQueryDto } from "./dto/list-purchasing-documents-query.dto";
import { CreatePurchaseReceiptDto } from "./dto/purchase-receipt.dto";
import { PurchaseReceiptsService } from "./purchase-receipts.service";

@ApiTags("purchase-receipts")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller()
export class PurchaseReceiptsController {
  constructor(private readonly receipts: PurchaseReceiptsService) {}

  @Post("purchases/:purchaseId/receipts")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PURCHASES_RECEIVE)
  @ApiOperation({
    summary: "Create a DRAFT Purchase Receipt; Inventory is unchanged",
  })
  create(
    @Param("purchaseId", ParseUUIDPipe) purchaseId: string,
    @Body() dto: CreatePurchaseReceiptDto,
    @Req() request: AuthorizedRequest,
  ) {
    return this.receipts.create(purchaseId, dto, request.user.id);
  }

  @Get("purchases/:purchaseId/receipts")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PURCHASES_READ)
  @ApiOperation({ summary: "List Purchase Receipts" })
  findAll(
    @Param("purchaseId", ParseUUIDPipe) purchaseId: string,
    @Query() query: ListPurchasingDocumentsQueryDto,
  ) {
    return this.receipts.findAll(purchaseId, query);
  }

  @Get("purchase-receipts/:id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PURCHASES_READ)
  @ApiOperation({ summary: "Get a Purchase Receipt and its IN movements" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.receipts.findOne(id);
  }

  @Post("purchase-receipts/:id/post")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PURCHASES_RECEIVE)
  @ApiOperation({
    summary: "Atomically post an immutable Receipt and Inventory IN movements",
    description:
      "Revalidates remaining quantities inside a serializable transaction. A POSTED receipt cannot be posted or edited again.",
  })
  @ApiConflictResponse({
    description: "Duplicate posting, over-receipt, or lifecycle conflict",
  })
  post(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthorizedRequest,
  ) {
    return this.receipts.post(id, request.user.id);
  }
}
