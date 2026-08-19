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
import { CreatePurchaseReturnDto } from "./dto/purchase-return.dto";
import { PurchaseReturnsService } from "./purchase-returns.service";

@ApiTags("purchase-returns")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller()
export class PurchaseReturnsController {
  constructor(private readonly returns: PurchaseReturnsService) {}

  @Post("purchases/:purchaseId/returns")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PURCHASES_RETURN)
  @ApiOperation({
    summary: "Create a DRAFT Purchase Return; Inventory is unchanged",
  })
  create(
    @Param("purchaseId", ParseUUIDPipe) purchaseId: string,
    @Body() dto: CreatePurchaseReturnDto,
    @Req() request: AuthorizedRequest,
  ) {
    return this.returns.create(purchaseId, dto, request.user.id);
  }

  @Get("purchases/:purchaseId/returns")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PURCHASES_READ)
  @ApiOperation({ summary: "List Purchase Returns" })
  findAll(
    @Param("purchaseId", ParseUUIDPipe) purchaseId: string,
    @Query() query: ListPurchasingDocumentsQueryDto,
  ) {
    return this.returns.findAll(purchaseId, query);
  }

  @Get("purchase-returns/:id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PURCHASES_READ)
  @ApiOperation({ summary: "Get a Purchase Return and its OUT movements" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.returns.findOne(id);
  }

  @Post("purchase-returns/:id/post")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PURCHASES_RETURN)
  @ApiOperation({
    summary: "Atomically post an immutable Return and Inventory OUT movements",
    description:
      "Validates posted receiving, prior returns, and physical stock in one serializable transaction.",
  })
  @ApiConflictResponse({
    description:
      "Duplicate posting, over-return, insufficient stock, or lifecycle conflict",
  })
  post(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthorizedRequest,
  ) {
    return this.returns.post(id, request.user.id);
  }
}
