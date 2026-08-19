import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
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

@ApiTags("inventory")
@ApiBearerAuth()
@Controller("api")
export class InventoryController {
  constructor(private readonly upstream: UpstreamService) {}

  @Post("inventory/movements")
  @ApiBody({
    schema: {
      type: "object",
      required: ["type", "productId", "quantity"],
      properties: {
        type: { enum: ["INITIAL", "IN", "OUT", "ADJUSTMENT", "TRANSFER"] },
        productId: { type: "string", format: "uuid" },
        sourceLocationId: { type: "string", format: "uuid" },
        destinationLocationId: { type: "string", format: "uuid" },
        quantity: { type: "integer", minimum: 0 },
        reason: { type: "string", maxLength: 500 },
      },
    },
  })
  @ApiOperation({
    summary: "Apply a traceable inventory movement",
    description:
      "TRANSFER is atomic. ADJUSTMENT sets a target quantity and requires a reason; other types move a positive quantity.",
  })
  createMovement(
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      method: "POST",
      path: "inventory/movements",
      authorization,
      body,
    });
  }

  @Get("inventory/movements")
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "productId", required: false, format: "uuid" })
  @ApiQuery({ name: "locationId", required: false, format: "uuid" })
  @ApiQuery({
    name: "type",
    required: false,
    enum: ["INITIAL", "IN", "OUT", "ADJUSTMENT", "TRANSFER"],
  })
  @ApiQuery({ name: "from", required: false, format: "date-time" })
  @ApiQuery({ name: "to", required: false, format: "date-time" })
  @ApiOperation({ summary: "List inventory movement history" })
  movements(
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.get("inventory/movements", authorization, query);
  }

  @Get("inventory")
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "productId", required: false, format: "uuid" })
  @ApiQuery({ name: "locationId", required: false, format: "uuid" })
  @ApiQuery({ name: "inStock", required: false, type: Boolean })
  @ApiOperation({ summary: "List stock balances" })
  inventory(
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.get("inventory", authorization, query);
  }

  @Get("inventory/:id")
  @ApiOperation({ summary: "Get one stock balance" })
  inventoryRecord(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.get(`inventory/${id}`, authorization);
  }

  @Get("products/:id/inventory")
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "inStock", required: false, type: Boolean })
  @ApiOperation({ summary: "List a product's balances and total stock" })
  productInventory(
    @Param("id") id: string,
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.get(`products/${id}/inventory`, authorization, query);
  }

  private get(path: string, authorization?: string, query?: ProxyQuery) {
    return this.upstream.request("autorepuesto", {
      path,
      authorization,
      query,
    });
  }
}
