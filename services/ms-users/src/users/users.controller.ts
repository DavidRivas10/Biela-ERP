import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "../common/constants/permissions";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { CreateUserDto } from "./dto/create-user.dto";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ApiOperation({ summary: "List users with pagination and optional search" })
  findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ApiOperation({ summary: "Get one user" })
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_CREATE)
  @ApiOperation({ summary: "Create a user" })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.USERS_UPDATE)
  @ApiOperation({ summary: "Update user profile and role assignments" })
  update(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(":id/activate")
  @RequirePermissions(PERMISSIONS.USERS_ACTIVATE)
  @ApiOperation({ summary: "Activate a user" })
  activate(@Param("id") id: string) {
    return this.usersService.setActive(id, true);
  }

  @Patch(":id/deactivate")
  @RequirePermissions(PERMISSIONS.USERS_DEACTIVATE)
  @ApiOperation({ summary: "Deactivate a user" })
  deactivate(@Param("id") id: string) {
    return this.usersService.setActive(id, false);
  }
}
