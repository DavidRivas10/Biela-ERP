import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContextValue } from "../auth/AuthContext";
import { jsonResponse, testUser } from "../test/fixtures";
import { SaleFormPage } from "./SalesWorkspace";

let auth: AuthContextValue;
vi.mock("../auth/AuthContext", () => ({ useAuth: () => auth }));

function paginated(rows: unknown[]) {
  return { data: rows, meta: { page: 1, limit: 20, total: rows.length, pages: 1 } };
}

const product1 = {
  id: "product-1",
  code: "FILT-001",
  name: "Filtro de aceite",
  active: true,
  defaultSalePrice: "85.0000",
};
const product2 = {
  id: "product-2",
  code: "PAST-002",
  name: "Pastillas de freno",
  active: true,
  defaultSalePrice: "220.0000",
};
const location1 = {
  id: "location-1",
  code: "BOD-01",
  name: "Bodega principal",
  active: true,
};
const cashMethod = {
  id: "method-cash",
  code: "cash",
  name: "Efectivo",
  kind: "CASH",
  active: true,
};
const cashSession = {
  id: "session-1",
  status: "OPEN",
  cashRegister: { id: "reg-1", code: "CAJA-01", name: "Caja principal" },
};
const openAccount = {
  id: "sale-account-1",
  number: 55,
  accountLabel: "Corolla azul – Juan",
  status: "DRAFT",
  total: "0.00",
  _count: { items: 0 },
};

function stubFetch({
  products = [],
  locations = [],
  paymentMethods = [],
  cashSessions = [],
  openAccounts = [],
  saleDetails = {},
  onCreateSale,
  onPostSale,
  onPayment,
}: {
  products?: unknown[];
  locations?: unknown[];
  paymentMethods?: unknown[];
  cashSessions?: unknown[];
  openAccounts?: unknown[];
  saleDetails?: Record<string, unknown>;
  onCreateSale?: (body: unknown) => unknown;
  onPostSale?: (id: string) => unknown;
  onPayment?: (id: string, body: unknown) => unknown;
} = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
        "http://localhost",
      );
      const method = init?.method ?? "GET";
      const body: unknown = init?.body
        ? JSON.parse(init.body as string)
        : undefined;

      const saleIdMatch = /^\/api\/sales\/([^/]+)$/.exec(url.pathname);
      const postMatch = /^\/api\/sales\/([^/]+)\/post$/.exec(url.pathname);
      const paymentsMatch = /^\/api\/sales\/([^/]+)\/payments$/.exec(
        url.pathname,
      );

      if (method === "POST" && url.pathname === "/api/sales") {
        return Promise.resolve(
          jsonResponse(onCreateSale?.(body) ?? { id: "new-sale", number: 1, total: "0.00", status: "DRAFT" }),
        );
      }
      if (method === "POST" && postMatch) {
        return Promise.resolve(
          jsonResponse(onPostSale?.(postMatch[1]) ?? { id: postMatch[1], status: "POSTED" }),
        );
      }
      if (method === "POST" && paymentsMatch) {
        return Promise.resolve(
          jsonResponse(onPayment?.(paymentsMatch[1], body) ?? { id: "payment-1" }),
        );
      }
      if (saleIdMatch && saleDetails[saleIdMatch[1]])
        return Promise.resolve(jsonResponse(saleDetails[saleIdMatch[1]]));
      if (url.pathname === "/api/sales")
        return Promise.resolve(jsonResponse(paginated(openAccounts)));
      if (url.pathname === "/api/products")
        return Promise.resolve(jsonResponse(paginated(products)));
      if (url.pathname === "/api/locations")
        return Promise.resolve(jsonResponse(paginated(locations)));
      if (url.pathname === "/api/customers")
        return Promise.resolve(jsonResponse(paginated([])));
      if (url.pathname === "/api/payment-methods")
        return Promise.resolve(jsonResponse(paginated(paymentMethods)));
      if (url.pathname === "/api/cash-sessions")
        return Promise.resolve(jsonResponse(paginated(cashSessions)));
      return Promise.resolve(jsonResponse(paginated([])));
    }),
  );
}

function renderWorkspace(path = "/app/sales/new") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app/sales/new" element={<SaleFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
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
    hasPermission: vi.fn(() => true),
    hasAnyPermission: vi.fn(() => true),
    hasAllPermissions: vi.fn(() => true),
  };
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Ventas — tres columnas independientes", () => {
  it("agregar un producto en Mostrador no aparece en Cliente ni en Cuentas abiertas (bug de estado cruzado)", async () => {
    stubFetch({ products: [product1], locations: [location1] });
    renderWorkspace();

    const mostrador = screen.getByRole("heading", { name: "Venta rápida (mostrador)" }).closest("form")!;
    const cliente = screen.getByRole("heading", { name: "Cliente registrado" }).closest("form")!;
    const cuenta = screen
      .getByRole("heading", { name: "Cuentas abiertas" })
      .closest(".sales-panel") as HTMLElement;

    await within(mostrador).findByRole("option", { name: /FILT-001/ });
    await userEvent.selectOptions(
      within(mostrador).getByLabelText(/^Agregar producto/),
      "product-1",
    );

    expect(within(mostrador).getByText("FILT-001")).toBeVisible();
    expect(within(cliente).queryByText("FILT-001")).toBeNull();
    expect(within(cuenta).queryByText("FILT-001")).toBeNull();
    expect(
      within(cliente).getByText("Todavía no agregaste ningún producto."),
    ).toBeVisible();
    expect(
      within(cuenta).getByText("Todavía no agregaste ningún producto."),
    ).toBeVisible();
  });

  it("un scan físico solo llega al panel donde el vendedor está trabajando", async () => {
    stubFetch({ products: [product1, product2], locations: [location1] });
    renderWorkspace();

    const mostrador = screen.getByRole("heading", { name: "Venta rápida (mostrador)" }).closest("form")!;
    const cliente = screen.getByRole("heading", { name: "Cliente registrado" }).closest("form")!;

    // Default focus is Mostrador (the leftmost, most-used column) — a burst
    // of fast keystrokes there should land in Mostrador's table.
    fireScan("FILT-001");
    await waitFor(() =>
      expect(within(mostrador).getByText("FILT-001")).toBeVisible(),
    );
    expect(within(cliente).queryByText("FILT-001")).toBeNull();

    // Clicking into Cliente switches which panel a physical scan targets.
    await userEvent.click(
      within(cliente).getByLabelText(/^Buscar cliente/),
    );
    fireScan("PAST-002");
    await waitFor(() =>
      expect(within(cliente).getByText("PAST-002")).toBeVisible(),
    );
    expect(within(mostrador).queryByText("PAST-002")).toBeNull();
  });
});

describe("Venta rápida (mostrador) — cobrar en un solo paso", () => {
  it("crea, confirma y cobra la venta con una sola acción, con el monto precargado del total", async () => {
    const calls: string[] = [];
    stubFetch({
      products: [product1],
      locations: [location1],
      paymentMethods: [cashMethod],
      cashSessions: [cashSession],
      onCreateSale: (body) => {
        calls.push("create");
        expect((body as { items: unknown[] }).items).toHaveLength(1);
        return { id: "sale-97", number: 97, total: "85.00", status: "DRAFT" };
      },
      onPostSale: (id) => {
        calls.push("post");
        expect(id).toBe("sale-97");
        return { id, status: "POSTED" };
      },
      onPayment: (id, body) => {
        calls.push("payment");
        expect(id).toBe("sale-97");
        expect((body as { amount: string }).amount).toBe("85.00");
        expect((body as { cashSessionId: string }).cashSessionId).toBe(
          "session-1",
        );
        return { id: "payment-1" };
      },
    });
    const user = userEvent.setup();
    renderWorkspace();

    const mostrador = screen.getByRole("heading", { name: "Venta rápida (mostrador)" }).closest("form")!;
    await within(mostrador).findByRole("option", { name: /FILT-001/ });
    await user.selectOptions(
      within(mostrador).getByLabelText(/^Agregar producto/),
      "product-1",
    );

    // Payment method has exactly one active option — auto-selected — which
    // reveals the cash session field, also auto-selected (only one OPEN).
    await waitFor(() =>
      expect(
        within(mostrador).getByLabelText(/^Método de pago/),
      ).toHaveValue("method-cash"),
    );
    await waitFor(() =>
      expect(
        within(mostrador).getByLabelText<HTMLSelectElement>(
          /^Sesión de caja ABIERTA/,
        ).value,
      ).toBe("session-1"),
    );
    expect(
      within(mostrador).getByLabelText<HTMLInputElement>(/^Monto a cobrar/)
        .value,
    ).toBe("85.00");

    await user.click(
      within(mostrador).getByRole("button", { name: "Cobrar y confirmar" }),
    );

    await waitFor(() => expect(calls).toEqual(["create", "post", "payment"]));
    expect(
      await within(mostrador).findByText(/cobrada L 85\.00/),
    ).toBeVisible();
    // The panel resets, ready for the next walk-in customer.
    expect(
      within(mostrador).getByText("Todavía no agregaste ningún producto."),
    ).toBeVisible();
  });
});

describe("Cuentas abiertas — pestañas dentro del mismo workspace", () => {
  it("cambiar de pestaña no navega a otra ruta ni afecta a Mostrador o Cliente", async () => {
    stubFetch({
      products: [product1],
      locations: [location1],
      openAccounts: [openAccount],
      saleDetails: {
        "sale-account-1": {
          ...openAccount,
          documentDate: "2026-09-12T00:00:00.000Z",
          items: [],
        },
      },
    });
    const user = userEvent.setup();
    renderWorkspace();

    const mostrador = screen.getByRole("heading", { name: "Venta rápida (mostrador)" }).closest("form")!;
    await within(mostrador).findByRole("option", { name: /FILT-001/ });
    await user.selectOptions(
      within(mostrador).getByLabelText(/^Agregar producto/),
      "product-1",
    );
    expect(within(mostrador).getByText("FILT-001")).toBeVisible();

    const tab = await screen.findByRole("tab", {
      name: /Corolla azul – Juan/,
    });
    await user.click(tab);

    expect(await screen.findByDisplayValue("Corolla azul – Juan")).toBeVisible();
    // Mostrador's in-progress line survived the tab switch untouched.
    expect(within(mostrador).getByText("FILT-001")).toBeVisible();
  });
});

/** Simulates a physical USB/Bluetooth barcode scanner: a fast burst of
 * keystrokes followed by Enter, dispatched on `window` the same way a real
 * wedge scanner does. */
function fireScan(code: string) {
  let t = 0;
  for (const char of code) {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: char, bubbles: true }),
    );
    t += 1;
  }
  void t;
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
}
