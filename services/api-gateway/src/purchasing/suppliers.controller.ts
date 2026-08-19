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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { UpstreamService } from "../upstream/upstream.service";

type ProxyBody = Record<string, unknown>;
type ProxyQuery = Record<string, string | string[] | undefined>;

@ApiTags("suppliers")
@ApiBearerAuth()
@Controller("api/suppliers")
export class SuppliersController {
  constructor(private readonly upstream: UpstreamService) {}

  @Post()
  @ApiBody({ schema: { type: "object", required: ["code", "businessName"] } })
  @ApiOperation({ summary: "Create a Supplier" })
  create(
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("POST", "suppliers", authorization, body);
  }

  @Get()
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "code", required: false, type: String })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "active", required: false, type: Boolean })
  @ApiOperation({ summary: "List and filter Suppliers" })
  findAll(
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: "suppliers",
      authorization,
      query,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a Supplier" })
  findOne(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: `suppliers/${id}`,
      authorization,
    });
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a Supplier" })
  update(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("PATCH", `suppliers/${id}`, authorization, body);
  }

  @Patch(":id/activate")
  @ApiOperation({ summary: "Activate a Supplier" })
  activate(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("PATCH", `suppliers/${id}/activate`, authorization);
  }

  @Patch(":id/deactivate")
  @ApiOperation({ summary: "Deactivate a Supplier" })
  deactivate(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("PATCH", `suppliers/${id}/deactivate`, authorization);
  }

  private request(
    method: "POST" | "PATCH",
    path: string,
    authorization?: string,
    body?: ProxyBody,
  ) {
    return this.upstream.request("autorepuesto", {
      method,
      path,
      authorization,
      body,
    });
  }
}
