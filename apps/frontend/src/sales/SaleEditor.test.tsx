import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContextValue } from "../auth/AuthContext";
import { jsonResponse, testUser } from "../test/fixtures";
import { SaleFormPage } from "./SalesPages";

let auth: AuthContextValue;
vi.mock("../auth/AuthContext", () => ({ useAuth: () => auth }));

const emptyMeta = { page: 1, limit: 20, total: 0, pages: 0 };
const otherAccount = {
  id: "sale-2",
  number: 202,
  accountLabel: "Sentra gris – María",
  status: "DRAFT",
  total: "540.00",
  _count: { items: 3 },
};
const product1 = {
  id: "product-1",
  code: "FILT-001",
  name: "Filtro de aceite",
  active: true,
  defaultSalePrice: "85.0000",
};
const location1 = {
  id: "location-1",
  code: "BOD-01",
  name: "Bodega principal",
  active: true,
};
const location2 = {
  id: "location-2",
  code: "BOD-02",
  name: "Bodega trasera",
  active: true,
};

function stubFetch({
  sales = [otherAccount],
  products = [] as unknown[],
  locations = [] as unknown[],
  saleDetails = {},
}: {
  sales?: unknown[];
  products?: unknown[];
  locations?: unknown[];
  saleDetails?: Record<string, unknown>;
} = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL | Request) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
        "http://localhost",
      );
      const detailMatch = /^\/api\/sales\/([^/]+)$/.exec(url.pathname);
      if (detailMatch && saleDetails[detailMatch[1]])
        return Promise.resolve(jsonResponse(saleDetails[detailMatch[1]]));
      if (url.pathname === "/api/sales")
        return Promise.resolve(
          jsonResponse({ data: sales, meta: emptyMeta }),
        );
      if (url.pathname === "/api/products")
        return Promise.resolve(
          jsonResponse({ data: products, meta: emptyMeta }),
        );
      if (url.pathname === "/api/locations")
        return Promise.resolve(
          jsonResponse({ data: locations, meta: emptyMeta }),
        );
      return Promise.resolve(jsonResponse({ data: [], meta: emptyMeta }));
    }),
  );
}

function renderNewAccount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/app/sales/new?mode=cuenta"]}>
        <Routes>
          <Route path="/app/sales/new" element={<SaleFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderNewSale() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/app/sales/new"]}>
        <Routes>
          <Route path="/app/sales/new" element={<SaleFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderEdit(id: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/app/sales/${id}/edit`]}>
        <Routes>
          <Route path="/app/sales/:id/edit" element={<SaleFormPage />} />
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
  vi.useRealTimers();
});

describe("Open accounts (cuenta abierta) — tabs and local recovery", () => {
  it("shows the other open accounts as tabs, plus a tab to start a new one", async () => {
    stubFetch();
    renderNewAccount();

    expect(
      await screen.findByRole("tab", { name: /Sentra gris – María/ }),
    ).toBeVisible();
    expect(
      screen.getByRole("tab", { name: "+ Nueva cuenta" }),
    ).toBeVisible();
  });

  it("autosaves the in-progress account to localStorage", async () => {
    stubFetch({ sales: [] });
    renderNewAccount();

    // The "cuenta" fields render synchronously (a brand-new account has no
    // server detail to await), so no fake timers are needed until we get to
    // the debounce itself.
    const label = screen.getByLabelText(/^Etiqueta de la cuenta/);

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.change(label, { target: { value: "Corolla azul" } });
    await vi.advanceTimersByTimeAsync(700);

    const raw = localStorage.getItem("sale-draft:new");
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw!) as { data: { accountLabel: string } };
    expect(saved.data.accountLabel).toBe("Corolla azul");
  });

  it("offers to restore an autosaved draft and fills the form on demand", async () => {
    localStorage.setItem(
      "sale-draft:new",
      JSON.stringify({
        data: {
          mode: "cuenta",
          customerId: "",
          accountLabel: "Hilux blanca – Pedro",
          documentDate: "2026-09-09",
          paymentDueDate: "",
          notes: "",
          lines: [
            {
              key: 1,
              productId: "",
              sourceLocationId: "",
              quantity: "1",
              unitPrice: "",
              discountAmount: "0.00",
              taxAmount: "0.00",
            },
          ],
        },
        savedAt: new Date().toISOString(),
      }),
    );
    stubFetch({ sales: [] });
    const user = userEvent.setup();
    renderNewAccount();

    expect(
      screen.getByText("Hay cambios sin guardar de antes"),
    ).toBeVisible();
    expect(screen.queryByDisplayValue("Hilux blanca – Pedro")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Restaurar" }));

    expect(screen.getByDisplayValue("Hilux blanca – Pedro")).toBeVisible();
    expect(
      screen.queryByText("Hay cambios sin guardar de antes"),
    ).toBeNull();
  });

  it("discards a saved draft without applying it", async () => {
    localStorage.setItem(
      "sale-draft:new",
      JSON.stringify({
        data: {
          mode: "cuenta",
          customerId: "",
          accountLabel: "Hilux blanca – Pedro",
          documentDate: "2026-09-09",
          paymentDueDate: "",
          notes: "",
          lines: [],
        },
        savedAt: new Date().toISOString(),
      }),
    );
    stubFetch({ sales: [] });
    const user = userEvent.setup();
    renderNewAccount();

    screen.getByText("Hay cambios sin guardar de antes");
    await user.click(screen.getByRole("button", { name: "Descartar" }));

    expect(
      screen.queryByText("Hay cambios sin guardar de antes"),
    ).toBeNull();
    expect(localStorage.getItem("sale-draft:new")).toBeNull();
    expect(screen.queryByDisplayValue("Hilux blanca – Pedro")).toBeNull();
  });
});

describe("Venta rápida — campos secundarios de línea colapsados por defecto", () => {
  it("abre el precio hasta elegir uno y lo tuca una vez que llega el sugerido; el descuento/impuesto queda cerrado", async () => {
    stubFetch({ sales: [], products: [product1], locations: [location1] });
    const user = userEvent.setup();
    renderNewSale();

    const findPriceDetails = () =>
      [...document.querySelectorAll("details.line-field")].find((d) =>
        d.querySelector("summary")?.textContent?.includes("Precio"),
      ) as HTMLDetailsElement;
    const priceDetails = findPriceDetails();
    const moreDetails = document.querySelector(
      "details.line-more",
    ) as HTMLDetailsElement;
    expect(priceDetails.open).toBe(true);
    expect(moreDetails.open).toBe(false);
    expect(screen.getByText("Elegí uno")).toBeVisible();

    await screen.findByRole("option", { name: /FILT-001/ });
    await user.selectOptions(screen.getByLabelText(/^Producto 1/), "product-1");

    expect(await screen.findByText("L 85.00")).toBeVisible();
    expect(priceDetails.open).toBe(false);
    expect(moreDetails.open).toBe(false);
  });

  it("defaults a new line's location to the previous line's", async () => {
    stubFetch({
      sales: [],
      products: [product1],
      locations: [location1, location2],
    });
    const user = userEvent.setup();
    renderNewSale();

    await screen.findByRole("option", { name: /BOD-01/ });
    await user.selectOptions(
      screen.getByLabelText(/^Ubicación origen/),
      "location-1",
    );
    await user.click(screen.getByRole("button", { name: "Agregar producto" }));

    const secondLocation = document.querySelector(
      "#sale-location-2",
    ) as HTMLSelectElement;
    expect(secondLocation).not.toBeNull();
    expect(secondLocation.value).toBe("location-1");
  });

  it("moves the cursor to Cantidad right after a product is picked", async () => {
    stubFetch({ sales: [], products: [product1], locations: [location1] });
    const user = userEvent.setup();
    renderNewSale();

    await screen.findByRole("option", { name: /FILT-001/ });
    await user.selectOptions(screen.getByLabelText(/^Producto 1/), "product-1");

    expect(document.getElementById("sale-qty-1")).toHaveFocus();
  });

  it("keeps an existing discount/tax visible instead of hiding it behind the toggle", async () => {
    const draftSale = {
      id: "sale-9",
      number: 9,
      accountLabel: null,
      customerId: null,
      status: "DRAFT",
      documentDate: "2026-09-10T00:00:00.000Z",
      items: [
        {
          productId: "product-1",
          sourceLocationId: "location-1",
          quantity: 1,
          unitPrice: "85.0000",
          discountAmount: "10.00",
          taxAmount: "0.00",
        },
      ],
    };
    stubFetch({
      sales: [],
      products: [product1],
      locations: [location1],
      saleDetails: { "sale-9": draftSale },
    });
    renderEdit("sale-9");

    const moreDetails = await screen.findByText("Descuento / impuesto", {
      selector: "summary",
    });
    expect(
      (moreDetails.closest("details") as HTMLDetailsElement).open,
    ).toBe(true);
  });
});
