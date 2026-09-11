import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/fixtures";
import { InventoryMovementsPage } from "./InventoryPages";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: () => true }),
}));

const emptyMeta = { page: 1, limit: 20, total: 0, pages: 0 };

function stubFetch({
  products = [] as unknown[],
  locations = [] as unknown[],
} = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL | Request) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      if (url.pathname === "/api/products")
        return Promise.resolve(
          jsonResponse({
            data: products,
            meta: { ...emptyMeta, total: products.length },
          }),
        );
      if (url.pathname === "/api/locations")
        return Promise.resolve(
          jsonResponse({
            data: locations,
            meta: { ...emptyMeta, total: locations.length },
          }),
        );
      return Promise.resolve(jsonResponse({ data: [], meta: emptyMeta }));
    }),
  );
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/app/inventory/movements"]}>
        <InventoryMovementsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("Inventory movements — speed of capture", () => {
  it("auto-selects the only active location and jumps focus to Cantidad after a product is picked", async () => {
    stubFetch({
      products: [
        { id: "product-1", code: "FILT-001", name: "Filtro", active: true },
      ],
      locations: [
        { id: "location-1", code: "BOD-01", name: "Bodega", active: true },
      ],
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole("button", { name: "Nuevo movimiento manual" }),
    );
    await screen.findByRole("heading", { name: "Movimiento manual" });

    // Two "Producto" selectors exist at once (this form's, and the list's
    // own filter) — scope to the create form's by id instead of by role/label.
    const productSelect = document.getElementById(
      "movement-product",
    ) as HTMLSelectElement;
    await waitFor(() =>
      expect(productSelect.querySelector('option[value="product-1"]')).not
        .toBeNull(),
    );
    await user.selectOptions(productSelect, "product-1");

    expect(document.getElementById("movement-quantity")).toHaveFocus();
    const locationSelect = document.getElementById(
      "movement-location",
    ) as HTMLSelectElement;
    await waitFor(() => expect(locationSelect.value).toBe("location-1"));
  });
});
