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

@ApiTags("sales")
@ApiBearerAuth()
@Controller("api")
export class SalesController {
  constructor(private readonly upstream: UpstreamService) {}

  @Post("sales")
  @ApiBody({
    schema: {
      type: "object",
      required: ["documentDate", "items"],
      properties: {
        customerId: {
          type: "string",
          format: "uuid",
          nullable: true,
          description: "Omit or use null for a walk-in Sale",
        },
        documentDate: { type: "string", format: "date" },
        paymentDueDate: { type: "string", format: "date" },
        notes: { type: "string" },
        items: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            required: ["productId", "sourceLocationId", "quantity"],
            properties: {
              productId: { type: "string", format: "uuid" },
              sourceLocationId: { type: "string", format: "uuid" },
              quantity: { type: "integer", minimum: 1 },
              unitPrice: { type: "string", example: "125.5000" },
              discountAmount: { type: "string", example: "0.00" },
              taxAmount: { type: "string", example: "0.00" },
            },
          },
        },
      },
    },
  })
  @ApiOperation({ summary: "Create a DRAFT registered or walk-in Sale" })
  createSale(
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("POST", "sales", authorization, body);
  }

  @Get("sales")
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "number", required: false, type: Number })
  @ApiQuery({ name: "customerId", required: false, format: "uuid" })
  @ApiQuery({ name: "productId", required: false, format: "uuid" })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["DRAFT", "POSTED", "CANCELLED"],
  })
  @ApiQuery({ name: "from", required: false, format: "date" })
  @ApiQuery({ name: "to", required: false, format: "date" })
  @ApiOperation({ summary: "List and filter Sales" })
  listSales(
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: "sales",
      authorization,
      query,
    });
  }

  @Get("sales/:id")
  @ApiOperation({ summary: "Get Sale detail and Inventory OUT traceability" })
  getSale(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.get(`sales/${id}`, authorization);
  }

  @Patch("sales/:id")
  @ApiOperation({ summary: "Edit a DRAFT Sale" })
  updateSale(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("PATCH", `sales/${id}`, authorization, body);
  }

  @Post("sales/:id/post")
  @ApiOperation({ summary: "Atomically post Sale and Inventory OUT" })
  postSale(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("POST", `sales/${id}/post`, authorization);
  }

  @Post("sales/:id/cancel")
  @ApiOperation({ summary: "Cancel a DRAFT Sale" })
  cancelSale(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("POST", `sales/${id}/cancel`, authorization);
  }

  @Post("sales/:saleId/returns")
  @ApiBody({
    schema: {
      type: "object",
      required: ["reason", "items"],
      properties: {
        reason: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            required: [
              "saleItemId",
              "destinationLocationId",
              "quantityReturned",
            ],
          },
        },
      },
    },
  })
  @ApiOperation({ summary: "Create a DRAFT Sale Return" })
  createReturn(
    @Param("saleId") saleId: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("POST", `sales/${saleId}/returns`, authorization, body);
  }

  @Get("sales/:saleId/returns")
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["DRAFT", "POSTED", "CANCELLED"],
  })
  @ApiOperation({ summary: "List Sale Returns" })
  listReturns(
    @Param("saleId") saleId: string,
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: `sales/${saleId}/returns`,
      authorization,
      query,
    });
  }

  @Get("sale-returns/:id")
  @ApiOperation({ summary: "Get Sale Return and Inventory IN traceability" })
  getReturn(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.get(`sale-returns/${id}`, authorization);
  }

  @Post("sale-returns/:id/post")
  @ApiOperation({ summary: "Atomically post Sale Return and Inventory IN" })
  postReturn(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("POST", `sale-returns/${id}/post`, authorization);
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
