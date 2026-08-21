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
  ApiConflictResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { UpstreamService } from "../upstream/upstream.service";

type ProxyBody = Record<string, unknown>;
type ProxyQuery = Record<string, string | string[] | undefined>;

@ApiTags("finance")
@ApiBearerAuth()
@Controller("api")
export class FinanceController {
  constructor(private readonly upstream: UpstreamService) {}

  @Post("payment-methods")
  @ApiBody({
    schema: {
      type: "object",
      required: ["code", "name", "kind"],
      properties: {
        code: { type: "string" },
        name: { type: "string" },
        kind: { enum: ["CASH", "CARD", "BANK_TRANSFER", "OTHER"] },
        active: { type: "boolean" },
        notes: { type: "string" },
      },
    },
  })
  createMethod(
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.write("POST", "payment-methods", authorization, body);
  }
  @Get("payment-methods")
  @ApiQuery({
    name: "kind",
    required: false,
    enum: ["CASH", "CARD", "BANK_TRANSFER", "OTHER"],
  })
  listMethods(
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.list("payment-methods", query, authorization);
  }
  @Get("payment-methods/:id")
  getMethod(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.get(`payment-methods/${id}`, authorization);
  }
  @Patch("payment-methods/:id")
  updateMethod(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.write("PATCH", `payment-methods/${id}`, authorization, body);
  }
  @Patch("payment-methods/:id/activate")
  activateMethod(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.write("PATCH", `payment-methods/${id}/activate`, authorization);
  }
  @Patch("payment-methods/:id/deactivate")
  deactivateMethod(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.write(
      "PATCH",
      `payment-methods/${id}/deactivate`,
      authorization,
    );
  }

  @Post("cash-registers")
  createRegister(
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.write("POST", "cash-registers", authorization, body);
  }
  @Get("cash-registers")
  listRegisters(
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.list("cash-registers", query, authorization);
  }
  @Get("cash-registers/:id")
  getRegister(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.get(`cash-registers/${id}`, authorization);
  }
  @Patch("cash-registers/:id")
  updateRegister(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.write("PATCH", `cash-registers/${id}`, authorization, body);
  }
  @Patch("cash-registers/:id/activate")
  activateRegister(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.write("PATCH", `cash-registers/${id}/activate`, authorization);
  }
  @Patch("cash-registers/:id/deactivate")
  deactivateRegister(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.write(
      "PATCH",
      `cash-registers/${id}/deactivate`,
      authorization,
    );
  }
  @Post("cash-registers/:id/sessions/open")
  @ApiOperation({ summary: "Open the register's only current Cash Session" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["openingAmount"],
      properties: {
        openingAmount: { type: "string", example: "100.00" },
        notes: { type: "string" },
      },
    },
  })
  @ApiConflictResponse({
    description: "Register inactive or already has an OPEN session",
  })
  openSession(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.write(
      "POST",
      `cash-registers/${id}/sessions/open`,
      authorization,
      body,
    );
  }
  @Get("cash-registers/:id/current-session")
  currentSession(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.get(`cash-registers/${id}/current-session`, authorization);
  }

  @Get("cash-sessions")
  listSessions(
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.list("cash-sessions", query, authorization);
  }
  @Get("cash-sessions/:id")
  getSession(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.get(`cash-sessions/${id}`, authorization);
  }
  @Get("cash-sessions/:id/summary")
  @ApiOperation({
    summary: "Read movement totals and exact expected physical Cash",
    description:
      "OPEN sessions derive expected Cash live. CLOSED sessions expose the stored expected/count/difference snapshot.",
  })
  getSessionSummary(
    @Param("id") id: string,
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.list(`cash-sessions/${id}/summary`, query, authorization);
  }
  @Get("cash-movements")
  @ApiOperation({
    summary: "List paginated Cash Movements through ms-autorepuesto",
  })
  listCashMovements(
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.list("cash-movements", query, authorization);
  }
  @Post("cash-sessions/:id/movements")
  @ApiBody({
    schema: {
      type: "object",
      required: ["type", "amount", "reason"],
      properties: {
        type: { enum: ["MANUAL_IN", "MANUAL_OUT"] },
        amount: { type: "string", example: "100.00" },
        reason: { type: "string" },
      },
    },
  })
  createMovement(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.write(
      "POST",
      `cash-sessions/${id}/movements`,
      authorization,
      body,
    );
  }
  @Post("cash-sessions/:id/close")
  @ApiBody({
    schema: {
      type: "object",
      required: ["countedAmount"],
      properties: {
        countedAmount: { type: "string", example: "125.00" },
        notes: {
          type: "string",
          description: "Required when count differs from expected Cash",
        },
      },
    },
  })
  @ApiConflictResponse({ description: "Cash Session is already CLOSED" })
  closeSession(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.write("POST", `cash-sessions/${id}/close`, authorization, body);
  }

  @Post("sales/:id/payments")
  @ApiOperation({
    summary: "Record a partial or remaining exact Sale Payment",
    description:
      "CASH requires an OPEN Cash Session and may include tender/change. Non-cash creates no physical CashMovement.",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["paymentMethodId", "amount"],
      properties: {
        paymentMethodId: { type: "string", format: "uuid" },
        amount: { type: "string", example: "25.00" },
        cashSessionId: { type: "string", format: "uuid" },
        tenderedAmount: { type: "string", example: "30.00" },
        externalReference: { type: "string" },
        notes: { type: "string" },
      },
    },
  })
  @ApiConflictResponse({
    description: "Sale lifecycle, overpayment, or Cash Session conflict",
  })
  createPayment(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.write("POST", `sales/${id}/payments`, authorization, body);
  }
  @Get("sales/:id/payments")
  listPayments(
    @Param("id") id: string,
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.list(`sales/${id}/payments`, query, authorization);
  }
  @Post("sale-returns/:id/refunds")
  @ApiOperation({
    summary: "Refund a POSTED Sale Return within exact eligibility",
    description:
      "Eligibility is limited by Return value remaining and active received money. CASH additionally requires sufficient expected drawer Cash.",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["paymentMethodId", "amount"],
      properties: {
        paymentMethodId: { type: "string", format: "uuid" },
        amount: { type: "string", example: "20.00" },
        cashSessionId: { type: "string", format: "uuid" },
        externalReference: { type: "string" },
        notes: { type: "string" },
      },
    },
  })
  @ApiConflictResponse({
    description: "Lifecycle, Refund eligibility, or Cash availability conflict",
  })
  createRefund(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.write(
      "POST",
      `sale-returns/${id}/refunds`,
      authorization,
      body,
    );
  }
  @Get("sale-returns/:id/refunds")
  listRefunds(
    @Param("id") id: string,
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.list(`sale-returns/${id}/refunds`, query, authorization);
  }
  @Post("purchases/:id/payments")
  @ApiOperation({
    summary: "Record an exact Purchase Payment",
    description:
      "CASH decreases expected physical Cash; non-cash changes settlement only.",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["paymentMethodId", "amount"],
      properties: {
        paymentMethodId: { type: "string", format: "uuid" },
        amount: { type: "string", example: "250.00" },
        cashSessionId: { type: "string", format: "uuid" },
        externalReference: { type: "string" },
        notes: { type: "string" },
      },
    },
  })
  createPurchasePayment(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.write("POST", `purchases/${id}/payments`, authorization, body);
  }
  @Get("purchases/:id/payments")
  listPurchasePayments(
    @Param("id") id: string,
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.list(`purchases/${id}/payments`, query, authorization);
  }
  @Post("purchase-returns/:id/refunds")
  @ApiOperation({
    summary: "Record an eligible Supplier Refund",
    description:
      "A CASH Supplier Refund increases expected physical Cash and never changes Inventory.",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["paymentMethodId", "amount"],
      properties: {
        paymentMethodId: { type: "string", format: "uuid" },
        amount: { type: "string", example: "100.00" },
        cashSessionId: { type: "string", format: "uuid" },
        externalReference: { type: "string" },
        notes: { type: "string" },
      },
    },
  })
  createSupplierRefund(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.write(
      "POST",
      `purchase-returns/${id}/refunds`,
      authorization,
      body,
    );
  }
  @Get("purchase-returns/:id/refunds")
  listSupplierRefunds(
    @Param("id") id: string,
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.list(`purchase-returns/${id}/refunds`, query, authorization);
  }
  @Get("payments/:id")
  getPayment(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.get(`payments/${id}`, authorization);
  }
  @Post("payments/:id/reverse")
  @ApiOperation({
    summary: "Reverse a Payment/Refund without deleting history",
    description:
      "A CASH reversal requires an OPEN reversal session and writes one compensating CashMovement.",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["reason"],
      properties: {
        reason: { type: "string" },
        cashSessionId: { type: "string", format: "uuid" },
      },
    },
  })
  @ApiConflictResponse({
    description:
      "Already reversed, insufficient Cash, or paid-vs-refunded invariant conflict",
  })
  reversePayment(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.write("POST", `payments/${id}/reverse`, authorization, body);
  }

  private get(path: string, authorization?: string) {
    return this.upstream.request("autorepuesto", { path, authorization });
  }
  private list(path: string, query: ProxyQuery, authorization?: string) {
    return this.upstream.request("autorepuesto", {
      path,
      query,
      authorization,
    });
  }
  private write(
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
