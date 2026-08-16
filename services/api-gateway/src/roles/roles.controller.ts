import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UpstreamService } from "../upstream/upstream.service";

type ProxyBody = Record<string, unknown>;

@ApiTags("roles")
@ApiBearerAuth()
@Controller("api/roles")
export class RolesController {
  constructor(private readonly upstream: UpstreamService) {}

  @Get()
  @ApiOperation({ summary: "List roles through ms-users" })
  findAll(@Headers("authorization") authorization?: string) {
    return this.upstream.request("users", { path: "roles", authorization });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a role through ms-users" })
  findOne(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("users", {
      path: `roles/${id}`,
      authorization,
    });
  }

  @Post()
  @ApiBody({ schema: { type: "object" } })
  @ApiOperation({ summary: "Create a role through ms-users" })
  create(
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("users", {
      method: "POST",
      path: "roles",
      authorization,
      body,
    });
  }

  @Patch(":id")
  @ApiBody({ schema: { type: "object" } })
  @ApiOperation({ summary: "Update a role through ms-users" })
  update(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("users", {
      method: "PATCH",
      path: `roles/${id}`,
      authorization,
      body,
    });
  }
}
