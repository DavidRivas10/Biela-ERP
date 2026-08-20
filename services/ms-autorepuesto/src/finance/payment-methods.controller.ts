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
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { BUSINESS_PERMISSIONS } from "../auth/constants/business-permissions";
import { RequireBusinessPermissions } from "../auth/decorators/permissions.decorator";
import { AutorepuestoAuthGuard } from "../auth/guards/autorepuesto-auth.guard";
import { BusinessPermissionsGuard } from "../auth/guards/business-permissions.guard";
import { ListPaymentMethodsQueryDto } from "./dto/list-payment-methods-query.dto";
import {
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
} from "./dto/payment-method.dto";
import { PaymentMethodsService } from "./payment-methods.service";

@ApiTags("payment-methods")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller("payment-methods")
export class PaymentMethodsController {
  constructor(private readonly methods: PaymentMethodsService) {}
  @Post()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PAYMENT_METHODS_MANAGE)
  @ApiOperation({ summary: "Create a Payment Method" })
  @ApiConflictResponse({ description: "Code already exists" })
  create(@Body() dto: CreatePaymentMethodDto) {
    return this.methods.create(dto);
  }
  @Get()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PAYMENT_METHODS_READ)
  findAll(@Query() query: ListPaymentMethodsQueryDto) {
    return this.methods.findAll(query);
  }
  @Get(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PAYMENT_METHODS_READ)
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.methods.findOne(id);
  }
  @Patch(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PAYMENT_METHODS_MANAGE)
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    return this.methods.update(id, dto);
  }
  @Patch(":id/activate")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PAYMENT_METHODS_MANAGE)
  activate(@Param("id", ParseUUIDPipe) id: string) {
    return this.methods.setActive(id, true);
  }
  @Patch(":id/deactivate")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PAYMENT_METHODS_MANAGE)
  deactivate(@Param("id", ParseUUIDPipe) id: string) {
    return this.methods.setActive(id, false);
  }
}
