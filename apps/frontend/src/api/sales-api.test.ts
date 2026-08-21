import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/fixtures";
import { customersApi } from "./customers-api";
import { salesApi } from "./sales-api";
import { salesFinanceApi } from "./sales-finance-api";

const mockJson = (payload: unknown = {}) => {
  const mock = vi.fn(() => Promise.resolve(jsonResponse(payload)));
  vi.stubGlobal("fetch", mock);
  return mock;
};
const request = (mock: ReturnType<typeof vi.fn>) => {
  const [input, init] = mock.mock.calls[0] as [string, RequestInit];
  return { url: new URL(input), init, body: typeof init.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined };
};

afterEach(() => vi.unstubAllGlobals());

describe("Frontend Phase 10.D Gateway API modules", () => {
  it("uses server pagination and search for Customers", async () => {
    const mock = mockJson({ data: [], meta: {} });
    await customersApi.list({ page: 6, limit: 20, search: "CLI-101", active: true });
    expect(request(mock).url.pathname).toBe("/api/customers");
    expect(Object.fromEntries(request(mock).url.searchParams)).toEqual({ page: "6", limit: "20", search: "CLI-101", active: "true" });
  });

  it("creates, updates and changes Customer lifecycle through explicit routes", async () => {
    const mock = mockJson({ id: "customer-1" });
    await customersApi.create({ code: "CLI-1", name: "Ana" });
    expect(request(mock).init.method).toBe("POST");
    mock.mockClear();
    await customersApi.update("customer-1", { name: "Ana López" });
    expect(request(mock).url.pathname).toBe("/api/customers/customer-1");
    mock.mockClear();
    await customersApi.setActive("customer-1", false);
    expect(request(mock).url.pathname).toBe("/api/customers/customer-1/deactivate");
  });

  it("sends walk-in Sales and exact line prices without numeric conversion", async () => {
    const mock = mockJson({ id: "sale-1" });
    await salesApi.create({ customerId: null, documentDate: "2026-08-20", items: [{ productId: "product-1", sourceLocationId: "location-1", quantity: 2, unitPrice: "10.1234", discountAmount: "1.25" }] });
    expect(request(mock).url.pathname).toBe("/api/sales");
    expect(request(mock).body).toMatchObject({ customerId: null, items: [{ unitPrice: "10.1234", discountAmount: "1.25" }] });
  });

  it("uses explicit Sale post and cancel commands", async () => {
    const mock = mockJson({ id: "sale-1" });
    await salesApi.post("sale-1");
    expect(request(mock).url.pathname).toBe("/api/sales/sale-1/post");
    mock.mockClear();
    await salesApi.cancel("sale-1");
    expect(request(mock).url.pathname).toBe("/api/sales/sale-1/cancel");
  });

  it("creates and posts Sale Returns with per-line destinations", async () => {
    const mock = mockJson({ id: "return-1" });
    await salesApi.createReturn("sale-1", { reason: "Producto incorrecto", items: [{ saleItemId: "line-1", destinationLocationId: "location-2", quantityReturned: 1 }] });
    expect(request(mock).url.pathname).toBe("/api/sales/sale-1/returns");
    expect(request(mock).body).toMatchObject({ items: [{ destinationLocationId: "location-2", quantityReturned: 1 }] });
    mock.mockClear();
    await salesApi.postReturn("return-1");
    expect(request(mock).url.pathname).toBe("/api/sale-returns/return-1/post");
  });

  it("preserves CASH tender and exact amount on Sale Payments", async () => {
    const mock = mockJson({ id: "payment-1" });
    await salesFinanceApi.createPayment("sale-1", { paymentMethodId: "cash", cashSessionId: "session-1", amount: "75.25", tenderedAmount: "100.00" });
    expect(request(mock).url.pathname).toBe("/api/sales/sale-1/payments");
    expect(request(mock).body).toEqual({ paymentMethodId: "cash", cashSessionId: "session-1", amount: "75.25", tenderedAmount: "100.00" });
  });

  it("uses separate Refund history/create and the shared reversal route", async () => {
    const mock = mockJson({ data: [], meta: {} });
    await salesFinanceApi.refunds("return-1", { page: 2, limit: 20 });
    expect(request(mock).url.pathname).toBe("/api/sale-returns/return-1/refunds");
    mock.mockClear();
    await salesFinanceApi.createRefund("return-1", { paymentMethodId: "bank", amount: "10.00" });
    expect(request(mock).init.method).toBe("POST");
    mock.mockClear();
    await salesFinanceApi.reverse("payment-1", { reason: "Duplicado" });
    expect(request(mock).url.pathname).toBe("/api/payments/payment-1/reverse");
  });

  it("passes operational Receivables filters to the server", async () => {
    const mock = mockJson({ data: [], meta: {}, summary: {} });
    await salesFinanceApi.receivables({ page: 3, limit: 20, overdueOnly: true, settlementStatus: "PARTIALLY_PAID", customerId: "customer-1" });
    const url = request(mock).url;
    expect(url.pathname).toBe("/api/commercial/receivables");
    expect(url.searchParams.get("overdueOnly")).toBe("true");
    expect(url.searchParams.get("settlementStatus")).toBe("PARTIALLY_PAID");
  });
});
