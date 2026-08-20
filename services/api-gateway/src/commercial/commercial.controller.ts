import { Controller, Get, Headers, Param, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { UpstreamService } from "../upstream/upstream.service";

type ProxyQuery = Record<string, string | string[] | undefined>;

@ApiTags("commercial")
@ApiBearerAuth()
@Controller("api")
export class CommercialController {
  constructor(private readonly upstream: UpstreamService) {}

  @Get("customers/:id/account")
  @ApiOperation({ summary: "Read a derived operational Customer account" })
  customerAccount(
    @Param("id") id: string,
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.get(`customers/${id}/account`, query, authorization);
  }

  @Get("suppliers/:id/account")
  @ApiOperation({ summary: "Read a derived operational Supplier account" })
  supplierAccount(
    @Param("id") id: string,
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.get(`suppliers/${id}/account`, query, authorization);
  }

  @Get("commercial/receivables")
  @ApiOperation({
    summary: "List paginated operational receivables",
    description: "Outstanding walk-in Sales remain visible.",
  })
  @ApiQuery({ name: "customerId", required: false, format: "uuid" })
  @ApiQuery({
    name: "settlementStatus",
    required: false,
    enum: ["UNPAID", "PARTIALLY_PAID", "PAID"],
  })
  @ApiQuery({ name: "overdueOnly", required: false, type: Boolean })
  receivables(
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.get("commercial/receivables", query, authorization);
  }

  @Get("commercial/payables")
  @ApiOperation({ summary: "List paginated operational payables and credits" })
  @ApiQuery({ name: "supplierId", required: false, format: "uuid" })
  @ApiQuery({
    name: "settlementStatus",
    required: false,
    enum: ["UNPAID", "PARTIALLY_PAID", "PAID"],
  })
  @ApiQuery({ name: "overdueOnly", required: false, type: Boolean })
  payables(
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.get("commercial/payables", query, authorization);
  }

  @Get("commercial/summary")
  @ApiOperation({
    summary: "Read current operational AR, AP, and OPEN-session Cash totals",
    description:
      "No accounting profit, COGS, forecasts, or financial statements are calculated.",
  })
  summary(@Headers("authorization") authorization?: string) {
    return this.get("commercial/summary", {}, authorization);
  }

  private get(path: string, query: ProxyQuery, authorization?: string) {
    return this.upstream.request("autorepuesto", {
      path,
      query,
      authorization,
    });
  }
}
