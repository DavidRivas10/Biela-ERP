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

@ApiTags("locations")
@ApiBearerAuth()
@Controller("api/locations")
export class LocationsController {
  constructor(private readonly upstream: UpstreamService) {}

  @Post()
  @ApiBody({ schema: { type: "object", required: ["code", "name"] } })
  @ApiOperation({ summary: "Create a physical storage location" })
  create(
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("POST", "locations", authorization, body);
  }

  @Get()
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "code", required: false, type: String })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "active", required: false, type: Boolean })
  @ApiOperation({ summary: "List and filter physical locations" })
  findAll(
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: "locations",
      authorization,
      query,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a physical storage location" })
  findOne(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: `locations/${id}`,
      authorization,
    });
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a physical storage location" })
  update(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("PATCH", `locations/${id}`, authorization, body);
  }

  @Patch(":id/activate")
  @ApiOperation({ summary: "Activate a physical storage location" })
  activate(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("PATCH", `locations/${id}/activate`, authorization);
  }

  @Patch(":id/deactivate")
  @ApiOperation({ summary: "Deactivate a physical storage location" })
  deactivate(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("PATCH", `locations/${id}/deactivate`, authorization);
  }

  @Get(":id/inventory")
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "inStock", required: false, type: Boolean })
  @ApiOperation({ summary: "List products stored at a location" })
  inventory(
    @Param("id") id: string,
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: `locations/${id}/inventory`,
      authorization,
      query,
    });
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
