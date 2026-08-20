import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/fixtures";
import { VehicleDetailPage } from "../vehicles/VehiclePages";
import { ProductDetailPage } from "./ProductsPages";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: () => true }),
}));

const meta = (page: number) => ({
  page,
  limit: 20,
  total: 21,
  pages: 2,
});

function renderRoute(path: string, pattern: string, element: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={pattern} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function product() {
  return {
    id: "product-1",
    code: "PROD-1",
    name: "Producto",
    active: true,
    description: null,
    defaultSalePrice: null,
    category: { id: "category-1", name: "Categoría" },
    brand: { id: "brand-1", name: "Marca" },
    attributes: [],
    updatedAt: "2026-08-20T00:00:00.000Z",
  };
}

function vehicle(id: string, engine: string) {
  return {
    id,
    active: true,
    year: 2020,
    engine,
    generation: null,
    trim: null,
    model: {
      id: "model-1",
      name: "Corolla",
      brand: { id: "brand-1", name: "Toyota" },
    },
    compatibility: { id: `compat-${id}`, notes: null, active: true },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("Phase 11 detail pagination", () => {
  it("reaches inventory Locations and compatible Vehicles after the first Product detail page", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      const page = Number(url.searchParams.get("page") ?? 1);
      if (url.pathname === "/api/products/product-1")
        return Promise.resolve(jsonResponse(product()));
      if (url.pathname === "/api/products/product-1/inventory")
        return Promise.resolve(
          jsonResponse({
            data: [
              {
                id: `balance-${page}`,
                quantity: page,
                location: {
                  id: `location-${page}`,
                  code: page === 2 ? "LOCATION-021" : "LOCATION-001",
                  name: "Bodega",
                },
              },
            ],
            meta: meta(page),
            totalQuantity: 21,
          }),
        );
      if (url.pathname === "/api/products/product-1/vehicles")
        return Promise.resolve(
          jsonResponse({
            data: [
              vehicle(
                `vehicle-${page}`,
                page === 2 ? "ENGINE-021" : "ENGINE-001",
              ),
            ],
            meta: meta(page),
          }),
        );
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderRoute(
      "/app/catalog/products/product-1",
      "/app/catalog/products/:id",
      <ProductDetailPage />,
    );

    const inventorySection = (
      await screen.findByRole("heading", {
        name: "Inventario por ubicación",
      })
    ).closest("section");
    const vehiclesSection = screen
      .getByRole("heading", { name: "Vehículos compatibles" })
      .closest("section");
    if (!inventorySection || !vehiclesSection)
      throw new Error("Expected Product detail sections");

    await user.click(
      within(inventorySection).getByRole("button", { name: "Siguiente" }),
    );
    expect(
      await within(inventorySection).findByText("LOCATION-021"),
    ).toBeVisible();

    await user.click(
      within(vehiclesSection).getByRole("button", { name: "Siguiente" }),
    );
    expect(
      await within(vehiclesSection).findByText("ENGINE-021"),
    ).toBeVisible();

    const pageTwoRequests = fetchMock.mock.calls.filter(([input]) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      return (
        url.searchParams.get("page") === "2" &&
        url.searchParams.get("limit") === "20"
      );
    });
    expect(pageTwoRequests).toHaveLength(2);
  });

  it("reaches compatible Products after the first Vehicle detail page", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      const page = Number(url.searchParams.get("page") ?? 1);
      if (url.pathname === "/api/vehicles/vehicle-1")
        return Promise.resolve(jsonResponse(vehicle("vehicle-1", "2.0")));
      if (url.pathname === "/api/vehicles/vehicle-1/products")
        return Promise.resolve(
          jsonResponse({
            data: [
              {
                ...product(),
                id: `product-${page}`,
                code: page === 2 ? "PRODUCT-021" : "PRODUCT-001",
                compatibility: {
                  id: `compat-${page}`,
                  notes: null,
                  active: true,
                },
              },
            ],
            meta: meta(page),
          }),
        );
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderRoute(
      "/app/vehicles/vehicle-1",
      "/app/vehicles/:id",
      <VehicleDetailPage />,
    );

    const productsSection = (
      await screen.findByRole("heading", {
        name: "Productos compatibles",
      })
    ).closest("section");
    if (!productsSection) throw new Error("Expected Vehicle detail section");

    await user.click(
      within(productsSection).getByRole("button", { name: "Siguiente" }),
    );
    expect(
      await within(productsSection).findByText("PRODUCT-021"),
    ).toBeVisible();
    expect(
      fetchMock.mock.calls.some(([input]) => {
        const url = new URL(
          input instanceof Request ? input.url : input.toString(),
        );
        return (
          url.pathname === "/api/vehicles/vehicle-1/products" &&
          url.searchParams.get("page") === "2" &&
          url.searchParams.get("limit") === "20"
        );
      }),
    ).toBe(true);
  });
});
