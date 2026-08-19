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
import { ListSaleReturnsQueryDto } from "./dto/list-sale-returns-query.dto";
import { CreateSaleReturnDto } from "./dto/sale-return.dto";
import { SaleReturnsService } from "./sale-returns.service";

@ApiTags("sale-returns")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller()
export class SaleReturnsController {
  constructor(private readonly returns: SaleReturnsService) {}

  @Post("sales/:saleId/returns")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.SALES_RETURN)
  @ApiOperation({
    summary: "Create a DRAFT Sale Return; Inventory is unchanged",
  })
  create(
    @Param("saleId", ParseUUIDPipe) saleId: string,
    @Body() dto: CreateSaleReturnDto,
    @Req() request: AuthorizedRequest,
  ) {
    return this.returns.create(saleId, dto, request.user.id);
  }

  @Get("sales/:saleId/returns")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: "List Returns for one Sale" })
  findAll(
    @Param("saleId", ParseUUIDPipe) saleId: string,
    @Query() query: ListSaleReturnsQueryDto,
  ) {
    return this.returns.findAll(saleId, query);
  }

  @Get("sale-returns/:id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: "Get a Sale Return and its Inventory IN effects" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.returns.findOne(id);
  }

  @Post("sale-returns/:id/post")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.SALES_RETURN)
  @ApiOperation({
    summary: "Atomically post an immutable Return and Inventory IN movements",
    description:
      "Eligibility is sold quantity minus prior POSTED returns. No payment or refund is created.",
  })
  @ApiConflictResponse({
    description: "Duplicate posting, over-return, or lifecycle conflict",
  })
  post(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthorizedRequest,
  ) {
    return this.returns.post(id, request.user.id);
  }
}
