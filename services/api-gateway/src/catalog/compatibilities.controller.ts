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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UpstreamService } from "../upstream/upstream.service";

type ProxyBody = Record<string, unknown>;
type ProxyQuery = Record<string, string | string[] | undefined>;

@ApiTags("compatibilities")
@ApiBearerAuth()
@Controller("api/compatibilities")
export class CompatibilitiesController {
  constructor(private readonly upstream: UpstreamService) {}

  @Post()
  @ApiOperation({ summary: "Create a product-to-vehicle compatibility" })
  create(
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      method: "POST",
      path: "compatibilities",
      authorization,
      body,
    });
  }

  @Get()
  @ApiOperation({ summary: "List and filter compatibilities" })
  findAll(
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: "compatibilities",
      authorization,
      query,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a compatibility" })
  findOne(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: `compatibilities/${id}`,
      authorization,
    });
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update compatibility notes or active state" })
  update(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      method: "PATCH",
      path: `compatibilities/${id}`,
      authorization,
      body,
    });
  }
}
