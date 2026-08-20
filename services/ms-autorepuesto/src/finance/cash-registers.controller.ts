import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CashRegistersService } from "./cash-registers.service";
import { CashSessionsService } from "./cash-sessions.service";
import {
  CreateCashRegisterDto,
  UpdateCashRegisterDto,
} from "./dto/cash-register.dto";
import { OpenCashSessionDto } from "./dto/cash-session.dto";
import { ListCashRegistersQueryDto } from "./dto/list-cash-registers-query.dto";

@ApiTags("cash-registers")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller("cash-registers")
export class CashRegistersController {
  constructor(
    private readonly registers: CashRegistersService,
    private readonly sessions: CashSessionsService,
  ) {}
  @Post()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.CASH_REGISTERS_MANAGE)
  create(@Body() dto: CreateCashRegisterDto) {
    return this.registers.create(dto);
  }
  @Get()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.CASH_REGISTERS_READ)
  findAll(@Query() query: ListCashRegistersQueryDto) {
    return this.registers.findAll(query);
  }
  @Get(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.CASH_REGISTERS_READ)
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.registers.findOne(id);
  }
  @Patch(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.CASH_REGISTERS_MANAGE)
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCashRegisterDto,
  ) {
    return this.registers.update(id, dto);
  }
  @Patch(":id/activate")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.CASH_REGISTERS_MANAGE)
  activate(@Param("id", ParseUUIDPipe) id: string) {
    return this.registers.setActive(id, true);
  }
  @Patch(":id/deactivate")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.CASH_REGISTERS_MANAGE)
  deactivate(@Param("id", ParseUUIDPipe) id: string) {
    return this.registers.setActive(id, false);
  }
  @Post(":id/sessions/open")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.CASH_SESSIONS_OPEN)
  @ApiOperation({
    summary: "Atomically open the only current session for a register",
  })
  @ApiConflictResponse({
    description: "Inactive register or an OPEN session already exists",
  })
  open(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: OpenCashSessionDto,
    @Req() req: AuthorizedRequest,
  ) {
    return this.sessions.open(id, dto, req.user.id);
  }
  @Get(":id/current-session")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.CASH_SESSIONS_READ)
  current(@Param("id", ParseUUIDPipe) id: string) {
    return this.registers.currentSession(id);
  }
}
