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
import { CashSessionsService } from "./cash-sessions.service";
import {
  CloseCashSessionDto,
  CreateManualCashMovementDto,
} from "./dto/cash-session.dto";
import { ListCashSessionsQueryDto } from "./dto/list-cash-sessions-query.dto";
import { CashSessionSummaryQueryDto } from "./dto/cash-session-summary-query.dto";

@ApiTags("cash-sessions")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller("cash-sessions")
export class CashSessionsController {
  constructor(private readonly sessions: CashSessionsService) {}
  @Get()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.CASH_SESSIONS_READ)
  findAll(@Query() query: ListCashSessionsQueryDto) {
    return this.sessions.findAll(query);
  }
  @Get(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.CASH_SESSIONS_READ)
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.sessions.findOne(id);
  }
  @Get(":id/summary")
  @RequireBusinessPermissions(
    BUSINESS_PERMISSIONS.CASH_SESSIONS_READ,
    BUSINESS_PERMISSIONS.CASH_MOVEMENTS_READ,
  )
  @ApiOperation({
    summary: "Read exact Cash Session totals and optional movement detail",
  })
  summary(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: CashSessionSummaryQueryDto,
  ) {
    return this.sessions.summary(id, query.includeMovements);
  }
  @Post(":id/movements")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.CASH_MOVEMENTS_CREATE)
  @ApiOperation({ summary: "Create an immutable MANUAL_IN or MANUAL_OUT" })
  @ApiConflictResponse({
    description: "Closed/inactive session or insufficient expected Cash",
  })
  movement(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateManualCashMovementDto,
    @Req() req: AuthorizedRequest,
  ) {
    return this.sessions.createMovement(id, dto, req.user.id);
  }
  @Post(":id/close")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.CASH_SESSIONS_CLOSE)
  @ApiOperation({ summary: "Atomically snapshot and close a Cash Session" })
  close(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CloseCashSessionDto,
    @Req() req: AuthorizedRequest,
  ) {
    return this.sessions.close(id, dto, req.user.id);
  }
}
