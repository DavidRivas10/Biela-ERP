import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { BUSINESS_PERMISSIONS } from "../auth/constants/business-permissions";
import { RequireBusinessPermissions } from "../auth/decorators/permissions.decorator";
import { AutorepuestoAuthGuard } from "../auth/guards/autorepuesto-auth.guard";
import { BusinessPermissionsGuard } from "../auth/guards/business-permissions.guard";
import { CashMovementsService } from "./cash-movements.service";
import { ListCashMovementsQueryDto } from "./dto/list-cash-movements-query.dto";

@ApiTags("cash-movements")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller("cash-movements")
export class CashMovementsController {
  constructor(private readonly movements: CashMovementsService) {}

  @Get()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.CASH_MOVEMENTS_READ)
  @ApiOperation({
    summary: "List the immutable Cash Movement ledger with server pagination",
  })
  findAll(@Query() query: ListCashMovementsQueryDto) {
    return this.movements.findAll(query);
  }
}
