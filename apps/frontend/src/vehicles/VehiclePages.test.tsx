import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/fixtures";
import { VehicleBrandsPage, VehiclesPage } from "./VehiclePages";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: () => true }),
}));

function stubFetch(vehicles: unknown[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL | Request) => {
      const path = new URL(
        input instanceof Request ? input.url : input.toString(),
        "http://localhost",
      ).pathname;
      if (path === "/api/vehicle-brands")
        return Promise.resolve(
          jsonResponse([
            {
              id: "b1",
              code: "toyota",
              name: "Toyota",
              active: true,
              _count: { models: 3 },
            },
          ]),
        );
      if (path === "/api/vehicle-models")
        return Promise.resolve(jsonResponse([]));
      return Promise.resolve(
        jsonResponse({
          data: vehicles,
          meta: { page: 1, limit: 20, total: vehicles.length, pages: 1 },
        }),
      );
    }),
  );
}

function renderAt(node: React.ReactNode, path: string) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("VehiclesPage", () => {
  it("shows the build chain as navigation, not a help paragraph", async () => {
    stubFetch([]);
    renderAt(<VehiclesPage />, "/app/vehicles");

    const chain = await screen.findByRole("navigation", {
      name: "Cómo se arma un vehículo",
    });
    const links = within(chain).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/app/mantenimientos/marcas-vehiculo",
      "/app/mantenimientos/modelos",
      "/app/vehicles",
      "/app/compatibility",
    ]);
  });

  it("has a neutral empty state that names the prerequisites", async () => {
    stubFetch([]);
    renderAt(<VehiclesPage />, "/app/vehicles");

    expect(
      await screen.findByText("Todavía no hay vehículos"),
    ).toBeVisible();
    expect(
      screen.getByText(/Necesitás tener la marca y el modelo cargados/),
    ).toBeVisible();
  });

  it("switches to a search-empty state when a filter is applied", async () => {
    stubFetch([]);
    renderAt(<VehiclesPage />, "/app/vehicles?year=2015");

    expect(
      await screen.findByText("Ningún vehículo coincide"),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Quitar los filtros" }),
    ).toBeVisible();
  });
});

describe("VehicleBrandsPage", () => {
  it("shows how many models each brand has", async () => {
    stubFetch();
    renderAt(<VehicleBrandsPage />, "/app/mantenimientos/marcas-vehiculo");

    expect(await screen.findByText("3 modelos")).toBeVisible();
  });
});
