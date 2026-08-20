import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/fixtures";
import {
  LocationSelector,
  ProductSelector,
  VehicleSelector,
} from "./EntitySelectors";

const pageMeta = (page: number, total: number, pages: number) => ({
  page,
  limit: 20,
  total,
  pages,
});

function renderWithQueryClient(node: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {node}
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("high-cardinality entity selectors", () => {
  it("discovers and selects a Product outside the default page through server search", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      const targetSearch = url.searchParams.get("search") === "TARGET-101";
      return Promise.resolve(
        jsonResponse({
          data: targetSearch
            ? [
                {
                  id: "product-101",
                  code: "TARGET-101",
                  name: "Fuera de página",
                },
              ]
            : [{ id: "product-1", code: "FIRST-001", name: "Inicial" }],
          meta: pageMeta(1, targetSearch ? 1 : 101, targetSearch ? 1 : 6),
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    function Harness() {
      const [value, setValue] = useState("");
      return (
        <>
          <ProductSelector
            id="product"
            label="Producto"
            value={value}
            onChange={setValue}
          />
          <output>{value}</output>
        </>
      );
    }

    const user = userEvent.setup();
    renderWithQueryClient(<Harness />);
    expect(
      await screen.findByRole("option", { name: /FIRST-001/ }),
    ).toBeVisible();
    expect(screen.queryByRole("option", { name: /TARGET-101/ })).toBeNull();

    await user.type(screen.getByRole("searchbox"), "TARGET-101");
    const target = await screen.findByRole("option", { name: /TARGET-101/ });
    await user.selectOptions(screen.getByLabelText("Producto"), target);

    expect(screen.getByText("product-101")).toBeVisible();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        new URL(
          input instanceof Request ? input.url : input.toString(),
        ).searchParams.has("search", "TARGET-101"),
      ),
    ).toBe(true);
  });

  it("discovers and selects a Location outside the default page through server search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = new URL(
          input instanceof Request ? input.url : input.toString(),
        );
        const targetSearch = url.searchParams.get("search") === "BODEGA-101";
        return Promise.resolve(
          jsonResponse({
            data: targetSearch
              ? [{ id: "location-101", code: "BODEGA-101", name: "Remota" }]
              : [{ id: "location-1", code: "BODEGA-001", name: "Inicial" }],
            meta: pageMeta(1, targetSearch ? 1 : 101, targetSearch ? 1 : 6),
          }),
        );
      }),
    );

    function Harness() {
      const [value, setValue] = useState("");
      return (
        <>
          <LocationSelector
            id="location"
            label="Ubicación"
            value={value}
            onChange={setValue}
          />
          <output>{value}</output>
        </>
      );
    }

    const user = userEvent.setup();
    renderWithQueryClient(<Harness />);
    expect(
      await screen.findByRole("option", { name: /BODEGA-001/ }),
    ).toBeVisible();

    await user.type(screen.getByRole("searchbox"), "BODEGA-101");
    const target = await screen.findByRole("option", { name: /BODEGA-101/ });
    await user.selectOptions(screen.getByLabelText("Ubicación"), target);
    expect(screen.getByText("location-101")).toBeVisible();
  });

  it("retrieves and selects a Vehicle from a later server page", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      const page = Number(url.searchParams.get("page"));
      const vehicle = {
        id: page === 2 ? "vehicle-21" : "vehicle-1",
        year: page === 2 ? 2021 : 2020,
        engine: page === 2 ? "2.1 TARGET" : "2.0",
        model: {
          id: "model-1",
          name: "Corolla",
          brand: { id: "brand-1", name: "Toyota" },
        },
      };
      return Promise.resolve(
        jsonResponse({ data: [vehicle], meta: pageMeta(page, 21, 2) }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    function Harness() {
      const [value, setValue] = useState("");
      return (
        <>
          <VehicleSelector
            id="vehicle"
            label="Vehículo"
            value={value}
            filters={{ brandId: "brand-1" }}
            onChange={setValue}
          />
          <output>{value}</output>
        </>
      );
    }

    const user = userEvent.setup();
    renderWithQueryClient(<Harness />);
    expect(await screen.findByRole("option", { name: /2020/ })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    const target = await screen.findByRole("option", { name: /2.1 TARGET/ });
    await user.selectOptions(screen.getByLabelText("Vehículo"), target);

    expect(screen.getByText("vehicle-21")).toBeVisible();
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          new URL(
            input instanceof Request ? input.url : input.toString(),
          ).searchParams.has("page", "2"),
        ),
      ).toBe(true),
    );
  });
});
