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
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import {
  CreateSalePaymentDto,
  CreateSaleRefundDto,
  ReversePaymentDto,
} from "./dto/payment.dto";
import { PaymentsService } from "./payments.service";

@ApiTags("payments")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @Post("sales/:id/payments")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PAYMENTS_CREATE)
  @ApiOperation({
    summary: "Atomically record a Sale Payment and its optional Cash effect",
  })
  @ApiConflictResponse({
    description: "Overpayment, lifecycle, or Cash Session conflict",
  })
  create(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateSalePaymentDto,
    @Req() req: AuthorizedRequest,
  ) {
    return this.payments.createSalePayment(id, dto, req.user.id);
  }
  @Get("sales/:id/payments")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PAYMENTS_READ)
  list(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.payments.findSalePayments(id, query);
  }
  @Post("sale-returns/:id/refunds")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PAYMENTS_CREATE)
  refund(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateSaleRefundDto,
    @Req() req: AuthorizedRequest,
  ) {
    return this.payments.createRefund(id, dto, req.user.id);
  }
  @Get("sale-returns/:id/refunds")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PAYMENTS_READ)
  refunds(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.payments.findRefunds(id, query);
  }
  @Get("payments/:id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PAYMENTS_READ)
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.payments.findOne(id);
  }
  @Post("payments/:id/reverse")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PAYMENTS_REVERSE)
  @ApiOperation({
    summary: "Reverse a Payment with an immutable compensating Cash movement",
  })
  reverse(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReversePaymentDto,
    @Req() req: AuthorizedRequest,
  ) {
    return this.payments.reverse(id, dto, req.user.id);
  }
}
