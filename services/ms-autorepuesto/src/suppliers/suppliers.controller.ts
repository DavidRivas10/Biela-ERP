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
import { ListSuppliersQueryDto } from "./dto/list-suppliers-query.dto";
import { CreateSupplierDto, UpdateSupplierDto } from "./dto/supplier.dto";
import { SuppliersService } from "./suppliers.service";

@ApiTags("suppliers")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Post()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.SUPPLIERS_CREATE)
  @ApiOperation({ summary: "Create a Supplier" })
  @ApiConflictResponse({ description: "Supplier code already exists" })
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliers.create(dto);
  }

  @Get()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.SUPPLIERS_READ)
  @ApiOperation({ summary: "List and filter Suppliers" })
  findAll(@Query() query: ListSuppliersQueryDto) {
    return this.suppliers.findAll(query);
  }

  @Get(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.SUPPLIERS_READ)
  @ApiOperation({ summary: "Get a Supplier" })
  @ApiNotFoundResponse({ description: "Supplier not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.suppliers.findOne(id);
  }

  @Patch(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.SUPPLIERS_UPDATE)
  @ApiOperation({ summary: "Update a Supplier without deleting history" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliers.update(id, dto);
  }

  @Patch(":id/activate")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.SUPPLIERS_UPDATE)
  @ApiOperation({ summary: "Activate a Supplier" })
  activate(@Param("id", ParseUUIDPipe) id: string) {
    return this.suppliers.setActive(id, true);
  }

  @Patch(":id/deactivate")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.SUPPLIERS_UPDATE)
  @ApiOperation({ summary: "Deactivate a Supplier while preserving history" })
  deactivate(@Param("id", ParseUUIDPipe) id: string) {
    return this.suppliers.setActive(id, false);
  }
}
