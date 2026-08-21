import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/fixtures";
import { purchasingFinanceApi } from "./purchasing-finance-api";
import { purchasingApi } from "./purchasing-api";
import { suppliersApi } from "./suppliers-api";

function mockJson(payload: unknown = {}) {
  const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(payload)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestOf(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url: new URL(url), init };
}

function bodyOf(init: RequestInit) {
  if (typeof init.body !== "string") throw new Error("Expected JSON body");
  return JSON.parse(init.body) as Record<string, unknown>;
}

afterEach(() => vi.unstubAllGlobals());

describe("Phase 12 Gateway API modules", () => {
  it("lists Suppliers with server pagination, search and lifecycle filters", async () => {
    const fetchMock = mockJson({ data: [], meta: {} });
    await suppliersApi.list({
      page: 4,
      limit: 20,
      search: "ACME",
      active: true,
    });
    const { url } = requestOf(fetchMock);
    expect(url.pathname).toBe("/api/suppliers");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: "4",
      limit: "20",
      search: "ACME",
      active: "true",
    });
  });

  it("creates and edits Suppliers through Gateway-relative requests", async () => {
    const fetchMock = mockJson({ id: "supplier-1" });
    await suppliersApi.create({ code: "SUP-1", businessName: "Proveedor Uno" });
    expect(requestOf(fetchMock).url.pathname).toBe("/api/suppliers");
    expect(requestOf(fetchMock).init.method).toBe("POST");

    fetchMock.mockClear();
    await suppliersApi.update("supplier-1", { businessName: "Proveedor 1" });
    const edit = requestOf(fetchMock);
    expect(edit.url.pathname).toBe("/api/suppliers/supplier-1");
    expect(edit.init.method).toBe("PATCH");
  });

  it("uses explicit Supplier activate/deactivate contracts", async () => {
    const fetchMock = mockJson({ id: "supplier-1", active: false });
    await suppliersApi.setActive("supplier-1", false);
    expect(requestOf(fetchMock).url.pathname).toBe(
      "/api/suppliers/supplier-1/deactivate",
    );
    fetchMock.mockClear();
    await suppliersApi.setActive("supplier-1", true);
    expect(requestOf(fetchMock).url.pathname).toBe(
      "/api/suppliers/supplier-1/activate",
    );
  });

  it("passes Purchase list filters to server pagination", async () => {
    const fetchMock = mockJson({ data: [], meta: {} });
    await purchasingApi.purchases({
      page: 2,
      limit: 20,
      supplierId: "supplier-1",
      status: "CONFIRMED",
      number: 101,
      from: "2026-08-01",
      to: "2026-08-20",
    });
    const { url } = requestOf(fetchMock);
    expect(url.pathname).toBe("/api/purchases");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("supplierId")).toBe("supplier-1");
    expect(url.searchParams.get("status")).toBe("CONFIRMED");
  });

  it("creates multi-line Purchases without converting exact money strings", async () => {
    const fetchMock = mockJson({ id: "purchase-1", total: "32.1234" });
    await purchasingApi.createPurchase({
      supplierId: "supplier-1",
      documentDate: "2026-08-20",
      items: [
        {
          productId: "product-1",
          orderedQuantity: 2,
          unitCost: "10.1234",
          taxAmount: "1.25",
        },
        {
          productId: "product-2",
          orderedQuantity: 1,
          unitCost: "11.8766",
          discountAmount: "1.00",
        },
      ],
    });
    const request = requestOf(fetchMock);
    expect(request.url.pathname).toBe("/api/purchases");
    expect(request.init.method).toBe("POST");
    expect(bodyOf(request.init)).toMatchObject({
      items: [
        { productId: "product-1", unitCost: "10.1234" },
        { productId: "product-2", unitCost: "11.8766" },
      ],
    });
  });

  it("updates, confirms and cancels a Purchase with explicit lifecycle calls", async () => {
    const fetchMock = mockJson({ id: "purchase-1" });
    await purchasingApi.updatePurchase("purchase-1", { notes: "Editada" });
    expect(requestOf(fetchMock).url.pathname).toBe("/api/purchases/purchase-1");
    expect(requestOf(fetchMock).init.method).toBe("PATCH");
    fetchMock.mockClear();
    await purchasingApi.confirmPurchase("purchase-1");
    expect(requestOf(fetchMock).url.pathname).toBe(
      "/api/purchases/purchase-1/confirm",
    );
    fetchMock.mockClear();
    await purchasingApi.cancelPurchase("purchase-1");
    expect(requestOf(fetchMock).url.pathname).toBe(
      "/api/purchases/purchase-1/cancel",
    );
  });

  it("creates partial Receipts then posts them through the stable contract", async () => {
    const fetchMock = mockJson({ id: "receipt-1" });
    await purchasingApi.createReceipt("purchase-1", {
      destinationLocationId: "location-1",
      items: [{ purchaseItemId: "line-1", quantityReceived: 2 }],
    });
    const create = requestOf(fetchMock);
    expect(create.url.pathname).toBe("/api/purchases/purchase-1/receipts");
    expect(bodyOf(create.init)).toMatchObject({
      items: [{ purchaseItemId: "line-1", quantityReceived: 2 }],
    });
    fetchMock.mockClear();
    await purchasingApi.postReceipt("receipt-1");
    expect(requestOf(fetchMock).url.pathname).toBe(
      "/api/purchase-receipts/receipt-1/post",
    );
  });

  it("creates Purchase Returns with per-line locations then posts them", async () => {
    const fetchMock = mockJson({ id: "return-1" });
    await purchasingApi.createReturn("purchase-1", {
      reason: "Empaque dañado",
      items: [
        {
          purchaseItemId: "line-1",
          sourceLocationId: "location-1",
          quantityReturned: 1,
        },
      ],
    });
    const create = requestOf(fetchMock);
    expect(create.url.pathname).toBe("/api/purchases/purchase-1/returns");
    expect(bodyOf(create.init)).toMatchObject({
      reason: "Empaque dañado",
      items: [{ sourceLocationId: "location-1", quantityReturned: 1 }],
    });
    fetchMock.mockClear();
    await purchasingApi.postReturn("return-1");
    expect(requestOf(fetchMock).url.pathname).toBe(
      "/api/purchase-returns/return-1/post",
    );
  });

  it("registers CASH and non-cash Purchase Payments as exact strings", async () => {
    const fetchMock = mockJson({ id: "payment-1" });
    await purchasingFinanceApi.createPurchasePayment("purchase-1", {
      paymentMethodId: "cash-1",
      cashSessionId: "session-1",
      amount: "125.50",
    });
    expect(bodyOf(requestOf(fetchMock).init)).toEqual({
      paymentMethodId: "cash-1",
      cashSessionId: "session-1",
      amount: "125.50",
    });
    fetchMock.mockClear();
    await purchasingFinanceApi.createPurchasePayment("purchase-1", {
      paymentMethodId: "bank-1",
      amount: "25.00",
      externalReference: "TRX-1",
    });
    expect(bodyOf(requestOf(fetchMock).init)).not.toHaveProperty(
      "cashSessionId",
    );
  });

  it("lists, creates and reverses Supplier Refunds without losing history", async () => {
    const fetchMock = mockJson({ data: [], meta: {} });
    await purchasingFinanceApi.supplierRefunds("return-1", {
      page: 2,
      limit: 20,
    });
    expect(requestOf(fetchMock).url.pathname).toBe(
      "/api/purchase-returns/return-1/refunds",
    );
    fetchMock.mockClear();
    await purchasingFinanceApi.createSupplierRefund("return-1", {
      paymentMethodId: "bank-1",
      amount: "15.00",
    });
    expect(requestOf(fetchMock).init.method).toBe("POST");
    fetchMock.mockClear();
    await purchasingFinanceApi.reverse("payment-1", {
      reason: "Registro duplicado",
    });
    expect(requestOf(fetchMock).url.pathname).toBe(
      "/api/payments/payment-1/reverse",
    );
  });

  it("requests Supplier accounts and global Payables with server filters", async () => {
    const fetchMock = mockJson({ data: [], meta: {}, summary: {} });
    await suppliersApi.account("supplier-1", { page: 3, limit: 20 });
    expect(requestOf(fetchMock).url.pathname).toBe(
      "/api/suppliers/supplier-1/account",
    );
    fetchMock.mockClear();
    await purchasingFinanceApi.payables({
      page: 2,
      limit: 20,
      overdueOnly: true,
      settlementStatus: "UNPAID",
    });
    const { url } = requestOf(fetchMock);
    expect(url.pathname).toBe("/api/commercial/payables");
    expect(url.searchParams.get("overdueOnly")).toBe("true");
    expect(url.searchParams.get("settlementStatus")).toBe("UNPAID");
  });
});
