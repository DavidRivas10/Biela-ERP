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

@ApiTags("purchases")
@ApiBearerAuth()
@Controller("api")
export class PurchasesController {
  constructor(private readonly upstream: UpstreamService) {}

  @Post("purchases")
  @ApiBody({
    schema: {
      type: "object",
      required: ["supplierId", "documentDate", "items"],
      properties: {
        supplierId: { type: "string", format: "uuid" },
        documentDate: { type: "string", format: "date" },
        items: {
          type: "array",
          items: {
            type: "object",
            required: ["productId", "orderedQuantity", "unitCost"],
          },
        },
      },
    },
  })
  @ApiOperation({ summary: "Create a DRAFT Purchase" })
  createPurchase(
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("POST", "purchases", authorization, body);
  }

  @Get("purchases")
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "supplierId", required: false, format: "uuid" })
  @ApiQuery({ name: "status", required: false, type: String })
  @ApiQuery({ name: "number", required: false, type: Number })
  @ApiQuery({ name: "supplierDocumentNumber", required: false, type: String })
  @ApiQuery({ name: "from", required: false, format: "date" })
  @ApiQuery({ name: "to", required: false, format: "date" })
  @ApiOperation({ summary: "List and filter Purchases" })
  listPurchases(
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: "purchases",
      authorization,
      query,
    });
  }

  @Get("purchases/:id")
  @ApiOperation({ summary: "Get Purchase detail" })
  getPurchase(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.get(`purchases/${id}`, authorization);
  }

  @Patch("purchases/:id")
  @ApiOperation({ summary: "Edit a DRAFT Purchase" })
  updatePurchase(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("PATCH", `purchases/${id}`, authorization, body);
  }

  @Post("purchases/:id/confirm")
  @ApiOperation({ summary: "Confirm a Purchase without changing Inventory" })
  confirmPurchase(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("POST", `purchases/${id}/confirm`, authorization);
  }

  @Post("purchases/:id/cancel")
  @ApiOperation({ summary: "Cancel an unreceived Purchase" })
  cancelPurchase(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("POST", `purchases/${id}/cancel`, authorization);
  }

  @Post("purchases/:purchaseId/receipts")
  @ApiBody({
    schema: {
      type: "object",
      required: ["destinationLocationId", "items"],
      properties: {
        destinationLocationId: { type: "string", format: "uuid" },
        items: {
          type: "array",
          items: {
            type: "object",
            required: ["purchaseItemId", "quantityReceived"],
          },
        },
      },
    },
  })
  @ApiOperation({ summary: "Create a DRAFT Purchase Receipt" })
  createReceipt(
    @Param("purchaseId") purchaseId: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request(
      "POST",
      `purchases/${purchaseId}/receipts`,
      authorization,
      body,
    );
  }

  @Get("purchases/:purchaseId/receipts")
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "status", required: false, type: String })
  @ApiOperation({ summary: "List Purchase Receipts" })
  listReceipts(
    @Param("purchaseId") purchaseId: string,
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: `purchases/${purchaseId}/receipts`,
      authorization,
      query,
    });
  }

  @Get("purchase-receipts/:id")
  @ApiOperation({ summary: "Get a Purchase Receipt and IN traceability" })
  getReceipt(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.get(`purchase-receipts/${id}`, authorization);
  }

  @Post("purchase-receipts/:id/post")
  @ApiOperation({ summary: "Atomically post a Purchase Receipt" })
  postReceipt(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("POST", `purchase-receipts/${id}/post`, authorization);
  }

  @Post("purchases/:purchaseId/returns")
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
              "purchaseItemId",
              "sourceLocationId",
              "quantityReturned",
            ],
          },
        },
      },
    },
  })
  @ApiOperation({ summary: "Create a DRAFT Purchase Return" })
  createReturn(
    @Param("purchaseId") purchaseId: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request(
      "POST",
      `purchases/${purchaseId}/returns`,
      authorization,
      body,
    );
  }

  @Get("purchases/:purchaseId/returns")
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "status", required: false, type: String })
  @ApiOperation({ summary: "List Purchase Returns" })
  listReturns(
    @Param("purchaseId") purchaseId: string,
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: `purchases/${purchaseId}/returns`,
      authorization,
      query,
    });
  }

  @Get("purchase-returns/:id")
  @ApiOperation({ summary: "Get a Purchase Return and OUT traceability" })
  getReturn(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.get(`purchase-returns/${id}`, authorization);
  }

  @Post("purchase-returns/:id/post")
  @ApiOperation({ summary: "Atomically post a Purchase Return" })
  postReturn(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("POST", `purchase-returns/${id}/post`, authorization);
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
