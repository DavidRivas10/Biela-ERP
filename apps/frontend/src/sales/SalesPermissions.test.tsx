import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContextValue } from "../auth/AuthContext";
import { jsonResponse, testUser } from "../test/fixtures";
import { SalePaymentsPage } from "./SalesFinancePages";

let permissions = new Set<string>();
vi.mock("../auth/AuthContext", () => ({
  useAuth: (): AuthContextValue => ({
    status: "authenticated", user: testUser, permissions, isAuthenticated: true,
    isInitializing: false, restoreError: null, login: vi.fn(), logout: vi.fn(),
    retryRestore: vi.fn(), hasPermission: (permission) => permissions.has(permission),
    hasAnyPermission: (required) => required.some((permission) => permissions.has(permission)),
    hasAllPermissions: (required) => required.every((permission) => permissions.has(permission)),
  }),
}));

const method = { id: "cash-1", code: "CASH", name: "Efectivo", kind: "CASH", active: true };
const sale = { id: "sale-1", number: 101, status: "POSTED", documentDate: "2026-08-20T00:00:00.000Z", subtotal: "100.00", discountTotal: "0.00", taxTotal: "0.00", total: "100.00", createdAt: "2026-08-20T12:00:00.000Z", updatedAt: "2026-08-20T12:00:00.000Z", items: [], paymentSummary: { saleTotal: "100.00", paidAmount: "25.00", outstandingAmount: "75.00", refundedAmount: "0.00", settlementStatus: "PARTIALLY_PAID" } };
const payment = { id: "payment-1", number: 501, type: "SALE_PAYMENT", status: "POSTED", amount: "25.00", paymentMethodId: method.id, paymentMethod: method, createdByActorId: "actor", createdAt: "2026-08-20T13:00:00.000Z", saleId: sale.id };
const meta = { page: 1, limit: 20, total: 1, pages: 1 };

function installFetch() {
  const mock = vi.fn((input: string | URL | Request) => {
    const path = new URL(input instanceof Request ? input.url : input.toString()).pathname;
    if (path === "/api/sales/sale-1") return Promise.resolve(jsonResponse(sale));
    if (path === "/api/sales/sale-1/payments") return Promise.resolve(jsonResponse({ data: [payment], meta }));
    if (path === "/api/payment-methods") return Promise.resolve(jsonResponse({ data: [method], meta }));
    if (path === "/api/cash-sessions") return Promise.resolve(jsonResponse({ data: [{ id: "session-1", status: "OPEN", cashRegister: { id: "register-1", code: "CAJA-1", name: "Principal", active: true } }], meta }));
    return Promise.resolve(jsonResponse({}));
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

function renderPage() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MemoryRouter initialEntries={["/app/sales/sale-1/payments"]}><Routes><Route path="/app/sales/:id/payments" element={<SalePaymentsPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => { permissions = new Set(); });
afterEach(() => vi.unstubAllGlobals());

describe("Frontend Phase 10.D sales financial permissions", () => {
  it("requires payments.create plus payment-methods.read for creation, independently of payments.read", async () => {
    const mock = installFetch();
    permissions = new Set(["payments.create", "payment-methods.read"]);
    renderPage();
    expect(await screen.findByRole("heading", { name: "Registrar pago" })).toBeVisible();
    expect(await screen.findByRole("option", { name: /Efectivo/ })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Historial" })).toBeNull();
    expect(mock.mock.calls.some(([input]) => new URL(input instanceof Request ? input.url : input.toString()).pathname === "/api/sales/sale-1/payments")).toBe(false);
  });

  it("uses payments.read for history and payments.reverse for reversal controls", async () => {
    installFetch();
    permissions = new Set(["payments.read", "payments.reverse"]);
    const first = renderPage();
    expect(await screen.findByText("#501")).toBeVisible();
    expect(screen.getByRole("button", { name: "Revertir" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Registrar pago" })).toBeNull();
    first.unmount();
    installFetch();
    permissions = new Set(["payments.read"]);
    renderPage();
    expect(await screen.findByText("#501")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Revertir" })).toBeNull();
  });

  it("does not query OPEN Cash Sessions until cash-sessions.read is granted", async () => {
    const user = userEvent.setup();
    permissions = new Set(["payments.create", "payment-methods.read"]);
    const mock = installFetch();
    renderPage();
    await screen.findByRole("option", { name: /Efectivo/ });
    await user.selectOptions(screen.getByRole("combobox", { name: /Método de pago/ }), "cash-1");
    expect(await screen.findByText(/No tiene permiso para consultar sesiones de caja/)).toBeVisible();
    expect(mock.mock.calls.some(([input]) => new URL(input instanceof Request ? input.url : input.toString()).pathname === "/api/cash-sessions")).toBe(false);
  });
});
