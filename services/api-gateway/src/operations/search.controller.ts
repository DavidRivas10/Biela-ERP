import { Controller, Get, Headers, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { UpstreamService } from "../upstream/upstream.service";

type ProxyQuery = Record<string, string | string[] | undefined>;

@ApiTags("search")
@ApiBearerAuth()
@Controller("api/search")
export class SearchController {
  constructor(private readonly upstream: UpstreamService) {}

  @Get("products")
  @ApiQuery({ name: "q", required: false, type: String })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "categoryId", required: false, format: "uuid" })
  @ApiQuery({ name: "brandId", required: false, format: "uuid" })
  @ApiQuery({ name: "active", required: false, type: Boolean })
  @ApiQuery({ name: "inStock", required: false, type: Boolean })
  @ApiQuery({ name: "vehicleId", required: false, format: "uuid" })
  @ApiQuery({ name: "vehicleBrandId", required: false, format: "uuid" })
  @ApiQuery({ name: "vehicleModelId", required: false, format: "uuid" })
  @ApiQuery({ name: "year", required: false, type: Number })
  @ApiQuery({ name: "engine", required: false, type: String })
  @ApiQuery({ name: "generation", required: false, type: String })
  @ApiQuery({ name: "trim", required: false, type: String })
  @ApiOperation({
    summary: "Deterministically search products",
    description:
      "Searches code/name and explicit vehicle compatibility, with exact code first and stable pagination.",
  })
  products(
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: "search/products",
      authorization,
      query,
    });
  }
}
