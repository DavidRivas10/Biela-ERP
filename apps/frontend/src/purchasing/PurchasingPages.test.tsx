import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContextValue } from "../auth/AuthContext";
import { jsonResponse, testUser } from "../test/fixtures";
import { PayablesPage } from "./PayablesPage";
import { PurchaseDetailPage, PurchaseFormPage } from "./PurchasePages";
import { PurchaseReceiptDetailPage } from "./ReceiptReturnPages";
import { PurchaseReturnDetailPage } from "./PurchaseFinancePages";
import { SupplierFormPage } from "./SupplierPages";

let auth: AuthContextValue;
vi.mock("../auth/AuthContext", () => ({ useAuth: () => auth }));

const emptyMeta = { page: 1, limit: 20, total: 0, pages: 0 };
const supplier = {
  id: "supplier-1",
  code: "SUP-001",
  businessName: "Proveedor Uno",
  active: true,
  createdAt: "2026-08-20T12:00:00.000Z",
  updatedAt: "2026-08-20T12:00:00.000Z",
};
const product = (id: string, code: string) => ({
  id,
  code,
  name: `Producto ${code}`,
  active: true,
});
const purchase = {
  id: "purchase-1",
  number: 101,
  supplierId: supplier.id,
  supplier,
  documentDate: "2026-08-20T00:00:00.000Z",
  paymentDueDate: "2026-08-25T00:00:00.000Z",
  status: "DRAFT",
  subtotal: "123.45",
  discountTotal: "3.00",
  taxTotal: "18.00",
  total: "138.45",
  createdAt: "2026-08-20T12:00:00.000Z",
  updatedAt: "2026-08-20T12:00:00.000Z",
  items: [
    {
      id: "line-1",
      purchaseId: "purchase-1",
      productId: "product-1",
      product: product("product-1", "PROD-001"),
      orderedQuantity: 10,
      unitCost: "12.3456",
      discountAmount: "3.00",
      taxAmount: "18.00",
      lineSubtotal: "123.45",
      lineTotal: "138.45",
      receivedQuantity: 4,
      returnedQuantity: 1,
      remainingReceivableQuantity: 6,
    },
  ],
  paymentSummary: {
    grossPurchaseValue: "138.45",
    purchaseReturnValue: "10.00",
    netPurchaseObligation: "128.45",
    paidAmount: "50.00",
    supplierRefundedAmount: "0.00",
    netPaidAmount: "50.00",
    outstandingAmount: "78.45",
    supplierCreditAmount: "0.00",
    settlementStatus: "PARTIALLY_PAID",
  },
};

function renderPage(path: string, route: string, node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={node} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, client };
}

beforeEach(() => {
  auth = {
    status: "authenticated",
    user: testUser,
    permissions: new Set(),
    isAuthenticated: true,
    isInitializing: false,
    restoreError: null,
    login: vi.fn(),
    logout: vi.fn(),
    retryRestore: vi.fn(),
    hasPermission: vi.fn(() => false),
    hasAnyPermission: vi.fn(() => false),
    hasAllPermissions: vi.fn(() => false),
  };
});

afterEach(() => vi.unstubAllGlobals());

describe("Frontend Phase 10.C purchasing screens", () => {
  it("preserves Supplier form input and exposes a duplicate 409", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ message: "El código de proveedor ya existe." }, 409),
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage(
      "/app/purchasing/suppliers/new",
      "/app/purchasing/suppliers/new",
      <SupplierFormPage />,
    );
    await user.type(screen.getByLabelText(/^Código/), "SUP-001");
    await user.type(screen.getByLabelText(/^Razón social/), "Proveedor Uno");
    await user.click(screen.getByRole("button", { name: "Guardar proveedor" }));
    expect(
      await screen.findByText(/código de proveedor ya existe/i),
    ).toBeVisible();
    expect(screen.getByLabelText(/^Código/)).toHaveValue("SUP-001");
    expect(screen.getByLabelText(/^Razón social/)).toHaveValue("Proveedor Uno");
  });

  it("builds a multi-line Purchase, blocks duplicates and preserves money strings", async () => {
    const fetchMock = vi.fn(
      (input: string | URL | Request, _init?: RequestInit) => {
        void _init;
        const url = new URL(
          input instanceof Request ? input.url : input.toString(),
        );
        if (url.pathname === "/api/suppliers")
          return Promise.resolve(
            jsonResponse({ data: [supplier], meta: emptyMeta }),
          );
        if (url.pathname === "/api/products")
          return Promise.resolve(
            jsonResponse({
              data: [
                product("product-1", "PROD-001"),
                product("product-2", "PROD-002"),
              ],
              meta: emptyMeta,
            }),
          );
        if (url.pathname === "/api/purchases")
          return Promise.resolve(
            jsonResponse({ ...purchase, id: "purchase-created" }),
          );
        return Promise.resolve(jsonResponse({}));
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage(
      "/app/purchasing/purchases/new",
      "/app/purchasing/purchases/new",
      <PurchaseFormPage />,
    );
    await screen.findByRole("option", { name: /SUP-001/ });
    await user.selectOptions(screen.getByLabelText(/^Proveedor/), "supplier-1");
    fireEvent.change(screen.getByLabelText(/^Fecha del documento/), {
      target: { value: "2026-08-20" },
    });
    await screen.findByRole("option", { name: /PROD-001/ });
    await user.selectOptions(screen.getByLabelText(/^Producto 1/), "product-1");
    await user.type(screen.getByLabelText(/^Costo unitario/), "12.3456");
    await user.click(screen.getByRole("button", { name: "Agregar producto" }));
    await user.selectOptions(
      await screen.findByLabelText(/^Producto 2/),
      "product-1",
    );
    await user.type(screen.getAllByLabelText(/^Costo unitario/)[1], "2.5000");
    await user.click(screen.getByRole("button", { name: "Guardar compra" }));
    expect(
      await screen.findByText(/solo puede aparecer una vez/i),
    ).toBeVisible();
    expect(
      fetchMock.mock.calls.filter(
        ([input]) =>
          new URL(input instanceof Request ? input.url : input.toString())
            .pathname === "/api/purchases",
      ),
    ).toHaveLength(0);
    await user.selectOptions(screen.getByLabelText(/^Producto 2/), "product-2");
    await user.click(screen.getByRole("button", { name: "Guardar compra" }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([, init]) => {
          if (init?.method !== "POST" || typeof init.body !== "string")
            return false;
          const body = JSON.parse(init.body) as {
            items: Array<{ unitCost: string }>;
          };
          return (
            body.items[0]?.unitCost === "12.3456" &&
            body.items[1]?.unitCost === "2.5000"
          );
        }),
      ).toBe(true),
    );
  });

  it("shows exact server totals, status and a confirmed lifecycle dialog", async () => {
    auth = {
      ...auth,
      hasPermission: vi.fn((code) => code === "purchases.update"),
    };
    const fetchMock = vi.fn(
      (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(
          input instanceof Request ? input.url : input.toString(),
        );
        if (
          url.pathname.endsWith("/receipts") ||
          url.pathname.endsWith("/returns")
        )
          return Promise.resolve(jsonResponse({ data: [], meta: emptyMeta }));
        if (init?.method === "POST")
          return Promise.resolve(
            jsonResponse({ message: "Estado inválido para confirmar." }, 409),
          );
        return Promise.resolve(jsonResponse(purchase));
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage(
      "/app/purchasing/purchases/purchase-1",
      "/app/purchasing/purchases/:id",
      <PurchaseDetailPage />,
    );
    expect(
      await screen.findByRole("heading", { name: "Compra #101" }),
    ).toBeVisible();
    expect(screen.getAllByText("L 138.45").length).toBeGreaterThan(0);
    expect(screen.getByText("Borrador")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/no modifica Inventario/i)).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    expect(
      await screen.findByText(/Estado inválido para confirmar/i),
    ).toBeVisible();
  });

  it("posts a Receipt only after confirmation and invalidates Inventory caches", async () => {
    auth = {
      ...auth,
      hasPermission: vi.fn((code) => code === "purchases.receive"),
    };
    let posted = false;
    const receipt = {
      id: "receipt-1",
      number: 201,
      purchaseId: "purchase-1",
      purchase: { id: "purchase-1", number: 101, status: "CONFIRMED" },
      destinationLocationId: "location-1",
      destinationLocation: {
        id: "location-1",
        code: "BOD-1",
        name: "Principal",
      },
      receivedAt: "2026-08-20T12:00:00.000Z",
      status: posted ? "POSTED" : "DRAFT",
      createdAt: "2026-08-20T12:00:00.000Z",
      items: [
        {
          id: "receipt-line-1",
          purchaseItemId: "line-1",
          quantityReceived: 4,
          purchaseItem: purchase.items[0],
        },
      ],
    };
    const fetchMock = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) => {
        if (init?.method === "POST") posted = true;
        return Promise.resolve(
          jsonResponse({ ...receipt, status: posted ? "POSTED" : "DRAFT" }),
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const { client } = renderPage(
      "/app/purchasing/receipts/receipt-1",
      "/app/purchasing/receipts/:id",
      <PurchaseReceiptDetailPage />,
    );
    const invalidate = vi.spyOn(client, "invalidateQueries");
    expect(await screen.findByText("Borrador")).toBeVisible();
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "POST"),
    ).toBe(false);
    await user.click(
      screen.getByRole("button", { name: "Publicar recepción" }),
    );
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Confirmar",
      }),
    );
    expect(
      await screen.findByText("Recepción registrada correctamente."),
    ).toBeVisible();
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["inventory", "balances"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["inventory", "movements"],
    });
  });

  it("shows posted Return eligibility and server-derived Supplier credit", async () => {
    const purchaseReturn = {
      id: "return-1",
      number: 301,
      purchaseId: "purchase-1",
      purchase: { id: "purchase-1", number: 101, status: "RECEIVED" },
      status: "POSTED",
      reason: "Producto defectuoso",
      createdAt: "2026-08-20T12:00:00.000Z",
      postedAt: "2026-08-20T13:00:00.000Z",
      items: [
        {
          id: "return-line-1",
          purchaseItemId: "line-1",
          sourceLocationId: "location-1",
          sourceLocation: {
            id: "location-1",
            code: "BOD-1",
            name: "Principal",
          },
          quantityReturned: 1,
          purchaseItem: purchase.items[0],
        },
      ],
      refundSummary: {
        returnValue: "25.00",
        refundedAmount: "10.00",
        refundableAmount: "15.00",
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(purchaseReturn))),
    );
    renderPage(
      "/app/purchasing/returns/return-1",
      "/app/purchasing/returns/:id",
      <PurchaseReturnDetailPage />,
    );
    expect(
      await screen.findByRole("heading", { name: "Devolución #301" }),
    ).toBeVisible();
    expect(screen.getByText("L 25.00")).toBeVisible();
    expect(screen.getByText("L 15.00")).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: /Registrar dinero recibido/i }),
    ).toBeNull();
  });

  it("renders paginated overdue Payables and sends URL-backed filters", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      if (url.pathname === "/api/suppliers")
        return Promise.resolve(
          jsonResponse({ data: [supplier], meta: emptyMeta }),
        );
      return Promise.resolve(
        jsonResponse({
          data: [
            {
              id: "purchase-1",
              number: 101,
              documentDate: "2026-08-01T00:00:00.000Z",
              paymentDueDate: "2026-08-10T00:00:00.000Z",
              supplierId: supplier.id,
              supplier,
              grossPurchaseValue: "100.00",
              purchaseReturnValue: "20.00",
              netPurchaseObligation: "80.00",
              paidAmount: "10.00",
              supplierRefundedAmount: "0.00",
              netPaidAmount: "10.00",
              outstandingAmount: "70.00",
              supplierCreditAmount: "0.00",
              settlementStatus: "PARTIALLY_PAID",
              overdue: true,
              ageInDays: 10,
            },
          ],
          summary: {
            documentCount: 1,
            grossAmount: "100.00",
            returnAmount: "20.00",
            netAmount: "80.00",
            paidAmount: "10.00",
            refundedAmount: "0.00",
            outstandingAmount: "70.00",
            creditAmount: "0.00",
            unpaidCount: 0,
            partiallyPaidCount: 1,
            paidCount: 0,
            overdueCount: 1,
            overdueAmount: "70.00",
            oldestDueDate: "2026-08-10",
          },
          meta: {
            page: Number(url.searchParams.get("page")) || 1,
            limit: 20,
            total: 21,
            pages: 2,
          },
          businessDate: "2026-08-20",
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage(
      "/app/commercial/payables",
      "/app/commercial/payables",
      <PayablesPage />,
    );
    expect(await screen.findByText("Vencida · 10 días")).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Vencimiento"), "true");
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => {
          const url = new URL(
            input instanceof Request ? input.url : input.toString(),
          );
          return (
            url.pathname === "/api/commercial/payables" &&
            url.searchParams.get("overdueOnly") === "true"
          );
        }),
      ).toBe(true),
    );
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => {
          const url = new URL(
            input instanceof Request ? input.url : input.toString(),
          );
          return (
            url.pathname === "/api/commercial/payables" &&
            url.searchParams.get("page") === "2"
          );
        }),
      ).toBe(true),
    );
  });
});
