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
import { CustomersService } from "./customers.service";
import { CreateCustomerDto, UpdateCustomerDto } from "./dto/customer.dto";
import { ListCustomersQueryDto } from "./dto/list-customers-query.dto";

@ApiTags("customers")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller("customers")
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.CUSTOMERS_CREATE)
  @ApiOperation({ summary: "Create a Customer" })
  @ApiConflictResponse({ description: "Customer code already exists" })
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }

  @Get()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.CUSTOMERS_READ)
  @ApiOperation({ summary: "List and deterministically filter Customers" })
  findAll(@Query() query: ListCustomersQueryDto) {
    return this.customers.findAll(query);
  }

  @Get(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.CUSTOMERS_READ)
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.customers.findOne(id);
  }

  @Patch(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.CUSTOMERS_UPDATE)
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(id, dto);
  }

  @Patch(":id/activate")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.CUSTOMERS_UPDATE)
  activate(@Param("id", ParseUUIDPipe) id: string) {
    return this.customers.setActive(id, true);
  }

  @Patch(":id/deactivate")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.CUSTOMERS_UPDATE)
  deactivate(@Param("id", ParseUUIDPipe) id: string) {
    return this.customers.setActive(id, false);
  }
}
