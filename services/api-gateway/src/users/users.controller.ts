import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UpstreamService } from "../upstream/upstream.service";

type ProxyBody = Record<string, unknown>;
type ProxyQuery = Record<string, string | string[] | undefined>;

@ApiTags("users")
@ApiBearerAuth()
@Controller("api/users")
export class UsersController {
  constructor(private readonly upstream: UpstreamService) {}

  @Get()
  @ApiOperation({ summary: "List users through ms-users" })
  findAll(
    @Headers("authorization") authorization: string | undefined,
    @Query() query: ProxyQuery,
  ) {
    return this.upstream.request("users", {
      path: "users",
      authorization,
      query,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a user through ms-users" })
  findOne(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("users", {
      path: `users/${id}`,
      authorization,
    });
  }

  @Post()
  @ApiBody({ schema: { type: "object" } })
  @ApiOperation({ summary: "Create a user through ms-users" })
  create(
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("users", {
      method: "POST",
      path: "users",
      authorization,
      body,
    });
  }

  @Patch(":id")
  @ApiBody({ schema: { type: "object" } })
  @ApiOperation({ summary: "Update a user through ms-users" })
  update(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("users", {
      method: "PATCH",
      path: `users/${id}`,
      authorization,
      body,
    });
  }

  @Patch(":id/activate")
  @ApiOperation({ summary: "Activate a user through ms-users" })
  activate(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("users", {
      method: "PATCH",
      path: `users/${id}/activate`,
      authorization,
    });
  }

  @Patch(":id/deactivate")
  @ApiOperation({ summary: "Deactivate a user through ms-users" })
  deactivate(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("users", {
      method: "PATCH",
      path: `users/${id}/deactivate`,
      authorization,
    });
  }
}
