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

@ApiTags("customers")
@ApiBearerAuth()
@Controller("api/customers")
export class CustomersController {
  constructor(private readonly upstream: UpstreamService) {}

  @Post()
  @ApiBody({
    schema: {
      type: "object",
      required: ["code", "name"],
      properties: {
        code: { type: "string" },
        name: { type: "string" },
        businessName: { type: "string" },
        taxId: { type: "string" },
        email: { type: "string", format: "email" },
      },
    },
  })
  @ApiOperation({ summary: "Create a Customer" })
  create(
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("POST", "customers", authorization, body);
  }

  @Get()
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "code", required: false, type: String })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "taxId", required: false, type: String })
  @ApiQuery({ name: "active", required: false, type: Boolean })
  @ApiOperation({ summary: "List and filter Customers" })
  findAll(
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: "customers",
      authorization,
      query,
    });
  }

  @Get(":id")
  findOne(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.get(`customers/${id}`, authorization);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("PATCH", `customers/${id}`, authorization, body);
  }

  @Patch(":id/activate")
  activate(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("PATCH", `customers/${id}/activate`, authorization);
  }

  @Patch(":id/deactivate")
  deactivate(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("PATCH", `customers/${id}/deactivate`, authorization);
  }

  private get(path: string, authorization?: string) {
    return this.upstream.request("autorepuesto", { path, authorization });
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
