import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/fixtures";
import { ProductsPage } from "./ProductsPages";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: () => true }),
}));

const categories = [
  {
    id: "c1",
    code: "cat-fil",
    name: "Filtros",
    active: true,
    _count: { products: 4, attributeDefinitions: 1 },
  },
  {
    id: "c2",
    code: "cat-vac",
    name: "Categoría vacía",
    active: true,
    _count: { products: 0, attributeDefinitions: 0 },
  },
];
const brands = [
  { id: "b1", code: "bosch", name: "Bosch", active: true, _count: { products: 2 } },
  { id: "b2", code: "brembo", name: "Brembo", active: true, _count: { products: 0 } },
];

function stubFetch(products: unknown[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL | Request) => {
      const path = new URL(
        input instanceof Request ? input.url : input.toString(),
        "http://localhost",
      ).pathname;
      if (path === "/api/product-categories")
        return Promise.resolve(jsonResponse(categories));
      if (path === "/api/product-brands")
        return Promise.resolve(jsonResponse(brands));
      return Promise.resolve(
        jsonResponse({
          data: products,
          meta: { page: 1, limit: 20, total: products.length, pages: 1 },
        }),
      );
    }),
  );
}

function renderProducts(path: string) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <ProductsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("ProductsPage filters and empty states", () => {
  it("explains an empty search with the term and offers to clear it", async () => {
    stubFetch([]);
    renderProducts("/app/catalog/products?search=001");

    expect(await screen.findByText("Ningún producto coincide")).toBeVisible();
    expect(
      screen.getByText(/No hay ningún producto con el texto «001»/),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Ver todos los productos" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Quitar «001»" }),
    ).toBeVisible();
  });

  it("names the category in the empty message", async () => {
    stubFetch([]);
    renderProducts("/app/catalog/products?categoryId=c1");

    expect(
      await screen.findByText(/en la categoría "Filtros"/),
    ).toBeVisible();
  });

  it("hides filter options that have zero products behind them", async () => {
    stubFetch([]);
    renderProducts("/app/catalog/products");

    // Wait for the catalogs to load into the selects.
    await screen.findByRole("option", { name: "Bosch (2)" });

    const brandOptions = within(screen.getByLabelText("Marca"))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(brandOptions).toEqual(["Todas las marcas", "Bosch (2)"]);

    const categoryOptions = within(screen.getByLabelText("Categoría"))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(categoryOptions).toEqual([
      "Todas las categorías",
      "Filtros (4)",
    ]);
  });

  it("shows a neutral empty state with no filters", async () => {
    stubFetch([]);
    renderProducts("/app/catalog/products");

    expect(
      await screen.findByText("Todavía no hay productos"),
    ).toBeVisible();
  });
});
