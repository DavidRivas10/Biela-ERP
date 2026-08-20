import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { BUSINESS_PERMISSIONS } from "../auth/constants/business-permissions";
import { RequireBusinessPermissions } from "../auth/decorators/permissions.decorator";
import { AutorepuestoAuthGuard } from "../auth/guards/autorepuesto-auth.guard";
import { BusinessPermissionsGuard } from "../auth/guards/business-permissions.guard";
import { CommercialService } from "./commercial.service";
import {
  CommercialDocumentQueryDto,
  PayablesQueryDto,
  ReceivablesQueryDto,
} from "./dto/commercial-query.dto";

@ApiTags("commercial")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller()
export class CommercialController {
  constructor(private readonly commercial: CommercialService) {}

  @Get("customers/:id/account")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.COMMERCIAL_RECEIVABLES_READ)
  @ApiOperation({ summary: "Read a derived operational Customer account" })
  customerAccount(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: CommercialDocumentQueryDto,
  ) {
    return this.commercial.customerAccount(id, query);
  }

  @Get("suppliers/:id/account")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.COMMERCIAL_PAYABLES_READ)
  @ApiOperation({ summary: "Read a derived operational Supplier account" })
  supplierAccount(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: CommercialDocumentQueryDto,
  ) {
    return this.commercial.supplierAccount(id, query);
  }

  @Get("commercial/receivables")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.COMMERCIAL_RECEIVABLES_READ)
  @ApiOperation({
    summary: "List operational receivables, including walk-in Sales",
  })
  receivables(@Query() query: ReceivablesQueryDto) {
    return this.commercial.receivables(query);
  }

  @Get("commercial/payables")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.COMMERCIAL_PAYABLES_READ)
  @ApiOperation({ summary: "List operational Supplier payables and credits" })
  payables(@Query() query: PayablesQueryDto) {
    return this.commercial.payables(query);
  }

  @Get("commercial/summary")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.COMMERCIAL_SUMMARY_READ)
  @ApiOperation({
    summary: "Read current operational settlement and physical-Cash totals",
    description:
      "This is not accounting, profit, COGS, forecasting, or a financial statement.",
  })
  summary() {
    return this.commercial.summary();
  }
}
