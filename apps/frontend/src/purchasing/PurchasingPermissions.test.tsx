import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContextValue } from "../auth/AuthContext";
import { jsonResponse, testUser } from "../test/fixtures";
import {
  PurchasePaymentsPage,
  PurchaseReturnDetailPage,
} from "./PurchaseFinancePages";
import { SupplierDetailPage } from "./SupplierPages";

let permissions = new Set<string>();

vi.mock("../auth/AuthContext", () => ({
  useAuth: (): AuthContextValue => ({
    status: "authenticated",
    user: testUser,
    permissions,
    isAuthenticated: true,
    isInitializing: false,
    restoreError: null,
    login: vi.fn(),
    logout: vi.fn(),
    retryRestore: vi.fn(),
    hasPermission: (permission) => permissions.has(permission),
    hasAnyPermission: (required) =>
      required.some((permission) => permissions.has(permission)),
    hasAllPermissions: (required) =>
      required.every((permission) => permissions.has(permission)),
  }),
}));

const meta = { page: 1, limit: 20, total: 1, pages: 1 };
const supplier = {
  id: "supplier-1",
  code: "SUP-001",
  businessName: "Proveedor Uno",
  active: true,
  createdAt: "2026-08-20T12:00:00.000Z",
  updatedAt: "2026-08-20T12:00:00.000Z",
};
const bankMethod = {
  id: "method-bank",
  code: "BANK",
  name: "Transferencia",
  kind: "BANK_TRANSFER",
  active: true,
};
const cashMethod = {
  id: "method-cash",
  code: "CASH",
  name: "Efectivo",
  kind: "CASH",
  active: true,
};
const purchase = {
  id: "purchase-1",
  number: 101,
  supplierId: supplier.id,
  supplier,
  documentDate: "2026-08-20T00:00:00.000Z",
  status: "RECEIVED",
  subtotal: "100.00",
  discountTotal: "0.00",
  taxTotal: "0.00",
  total: "100.00",
  createdAt: "2026-08-20T12:00:00.000Z",
  updatedAt: "2026-08-20T12:00:00.000Z",
  items: [],
  paymentSummary: {
    grossPurchaseValue: "100.00",
    purchaseReturnValue: "0.00",
    netPurchaseObligation: "100.00",
    paidAmount: "25.00",
    supplierRefundedAmount: "0.00",
    netPaidAmount: "25.00",
    outstandingAmount: "75.00",
    supplierCreditAmount: "0.00",
    settlementStatus: "PARTIALLY_PAID",
  },
};
const payment = {
  id: "payment-1",
  number: 501,
  type: "PURCHASE_PAYMENT",
  status: "POSTED",
  amount: "25.00",
  paymentMethodId: bankMethod.id,
  paymentMethod: bankMethod,
  createdByActorId: "actor-1",
  createdAt: "2026-08-20T13:00:00.000Z",
  purchaseId: purchase.id,
};
const purchaseReturn = {
  id: "return-1",
  number: 301,
  purchaseId: purchase.id,
  purchase: { id: purchase.id, number: purchase.number, status: "RECEIVED" },
  status: "POSTED",
  reason: "Defectuoso",
  createdAt: "2026-08-20T12:00:00.000Z",
  postedAt: "2026-08-20T13:00:00.000Z",
  items: [],
  refundSummary: {
    returnValue: "20.00",
    refundedAmount: "0.00",
    refundableAmount: "20.00",
  },
};

function renderPage(path: string, route: string, node: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={node} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function installFetch() {
  const fetchMock = vi.fn((input: string | URL | Request) => {
    const path = new URL(
      input instanceof Request ? input.url : input.toString(),
    ).pathname;
    if (path === "/api/purchases/purchase-1")
      return Promise.resolve(jsonResponse(purchase));
    if (path === "/api/purchases/purchase-1/payments")
      return Promise.resolve(jsonResponse({ data: [payment], meta }));
    if (path === "/api/payment-methods")
      return Promise.resolve(
        jsonResponse({ data: [bankMethod, cashMethod], meta }),
      );
    if (path === "/api/cash-sessions")
      return Promise.resolve(
        jsonResponse({
          data: [
            {
              id: "session-1",
              status: "OPEN",
              openingAmount: "100.00",
              openedAt: "2026-08-20T12:00:00.000Z",
              openedByActorId: "actor-1",
              cashRegisterId: "register-1",
              cashRegister: {
                id: "register-1",
                code: "CAJA-01",
                name: "Caja principal",
                active: true,
              },
            },
          ],
          meta,
        }),
      );
    if (path === "/api/purchase-returns/return-1")
      return Promise.resolve(jsonResponse(purchaseReturn));
    if (path === "/api/purchase-returns/return-1/refunds")
      return Promise.resolve(jsonResponse({ data: [payment], meta }));
    if (path === "/api/suppliers/supplier-1")
      return Promise.resolve(jsonResponse(supplier));
    if (path === "/api/suppliers/supplier-1/account")
      return Promise.resolve(
        jsonResponse({
          supplier,
          data: [],
          meta: { ...meta, total: 0, pages: 0 },
          summary: {
            documentCount: 0,
            grossAmount: "0.00",
            returnAmount: "0.00",
            netAmount: "0.00",
            paidAmount: "0.00",
            refundedAmount: "0.00",
            outstandingAmount: "0.00",
            creditAmount: "0.00",
            unpaidCount: 0,
            partiallyPaidCount: 0,
            paidCount: 0,
            overdueCount: 0,
            overdueAmount: "0.00",
            oldestDueDate: null,
          },
        }),
      );
    return Promise.resolve(jsonResponse({}));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  permissions = new Set();
});

afterEach(() => vi.unstubAllGlobals());

describe("Phase 12 purchasing permission contract", () => {
  it("uses purchases.pay, not payments.create, for Purchase Payment controls", async () => {
    permissions = new Set(["purchases.pay", "payment-methods.read"]);
    const fetchMock = installFetch();
    renderPage(
      "/app/purchasing/purchases/purchase-1/payments",
      "/app/purchasing/purchases/:id/payments",
      <PurchasePaymentsPage />,
    );

    expect(
      await screen.findByRole("heading", { name: "Registrar pago" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("option", { name: /Transferencia/ }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Historial de pagos" }),
    ).toBeNull();
    expect(
      fetchMock.mock.calls.some(
        ([input]) =>
          new URL(input instanceof Request ? input.url : input.toString())
            .pathname === "/api/purchases/purchase-1/payments",
      ),
    ).toBe(false);
  });

  it("requires payments.read for history and payments.reverse for reversal controls", async () => {
    permissions = new Set(["payments.read", "payments.reverse"]);
    installFetch();
    const first = renderPage(
      "/app/purchasing/purchases/purchase-1/payments",
      "/app/purchasing/purchases/:id/payments",
      <PurchasePaymentsPage />,
    );

    expect(
      await screen.findByRole("heading", { name: "Historial de pagos" }),
    ).toBeVisible();
    expect(await screen.findByText("#501")).toBeVisible();
    expect(await screen.findByRole("button", { name: "Reversar" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Registrar pago" }),
    ).toBeNull();

    first.unmount();
    permissions = new Set(["payments.read"]);
    installFetch();
    renderPage(
      "/app/purchasing/purchases/purchase-1/payments",
      "/app/purchasing/purchases/:id/payments",
      <PurchasePaymentsPage />,
    );
    expect(
      await screen.findByRole("heading", { name: "Historial de pagos" }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reversar" })).toBeNull();
  });

  it("uses purchases.pay, not payments.create, for Supplier Refund controls", async () => {
    permissions = new Set(["purchases.pay", "payment-methods.read"]);
    installFetch();
    renderPage(
      "/app/purchasing/returns/return-1",
      "/app/purchasing/returns/:id",
      <PurchaseReturnDetailPage />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Registrar dinero recibido del proveedor",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Reembolsos del proveedor" }),
    ).toBeNull();
  });

  it("queries OPEN Cash Sessions only with cash-sessions.read", async () => {
    const user = userEvent.setup();
    permissions = new Set(["purchases.pay", "payment-methods.read"]);
    let fetchMock = installFetch();
    const first = renderPage(
      "/app/purchasing/purchases/purchase-1/payments",
      "/app/purchasing/purchases/:id/payments",
      <PurchasePaymentsPage />,
    );
    await screen.findByRole("option", { name: /Efectivo/ });
    await user.selectOptions(
      await screen.findByLabelText(/^Método de pago/),
      cashMethod.id,
    );
    await waitFor(() =>
      expect(screen.getByLabelText(/^Sesión de caja OPEN/)).toBeVisible(),
    );
    expect(
      fetchMock.mock.calls.some(
        ([input]) =>
          new URL(input instanceof Request ? input.url : input.toString())
            .pathname === "/api/cash-sessions",
      ),
    ).toBe(false);

    first.unmount();
    permissions = new Set([
      "purchases.pay",
      "payment-methods.read",
      "cash-sessions.read",
    ]);
    fetchMock = installFetch();
    renderPage(
      "/app/purchasing/purchases/purchase-1/payments",
      "/app/purchasing/purchases/:id/payments",
      <PurchasePaymentsPage />,
    );
    await screen.findByRole("option", { name: /Efectivo/ });
    await user.selectOptions(
      await screen.findByLabelText(/^Método de pago/),
      cashMethod.id,
    );
    expect(
      await screen.findByRole("option", { name: /CAJA-01/ }),
    ).toBeVisible();
    expect(
      fetchMock.mock.calls.some(
        ([input]) =>
          new URL(input instanceof Request ? input.url : input.toString())
            .pathname === "/api/cash-sessions",
      ),
    ).toBe(true);
  });

  it("protects the embedded Supplier Account with commercial-payables.read", async () => {
    permissions = new Set();
    let fetchMock = installFetch();
    const first = renderPage(
      "/app/purchasing/suppliers/supplier-1",
      "/app/purchasing/suppliers/:id",
      <SupplierDetailPage />,
    );
    expect(
      await screen.findByRole("heading", { name: /SUP-001/ }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Cuenta por pagar" }),
    ).toBeNull();
    expect(
      fetchMock.mock.calls.some(
        ([input]) =>
          new URL(input instanceof Request ? input.url : input.toString())
            .pathname === "/api/suppliers/supplier-1/account",
      ),
    ).toBe(false);

    first.unmount();
    permissions = new Set(["commercial-payables.read"]);
    fetchMock = installFetch();
    renderPage(
      "/app/purchasing/suppliers/supplier-1",
      "/app/purchasing/suppliers/:id",
      <SupplierDetailPage />,
    );
    expect(
      await screen.findByRole("heading", { name: "Cuenta por pagar" }),
    ).toBeVisible();
    expect(
      fetchMock.mock.calls.some(
        ([input]) =>
          new URL(input instanceof Request ? input.url : input.toString())
            .pathname === "/api/suppliers/supplier-1/account",
      ),
    ).toBe(true);
  });
});
