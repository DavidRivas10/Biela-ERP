import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/fixtures";
import { SuppliersPage } from "./SupplierPages";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: () => true }),
}));

function stub(rows: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          data: rows,
          meta: { page: 1, limit: 20, total: rows.length, pages: 1 },
        }),
      ),
    ),
  );
}

function renderSuppliers() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/app/purchasing/suppliers"]}>
        <SuppliersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("SuppliersPage", () => {
  it("has no help-note box; explains its purpose in the description", async () => {
    stub([]);
    renderSuppliers();
    expect(
      await screen.findByText("Todavía no registraste proveedores"),
    ).toBeVisible();
    expect(
      screen.getByText(/A quién le comprás mercadería/),
    ).toBeVisible();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("shows purchase count and a direct 'register a bill' action per row", async () => {
    stub([
      {
        id: "s1",
        code: "REP-SUR",
        businessName: "Repuestos del Sur",
        active: true,
        _count: { purchases: 5 },
      },
    ]);
    renderSuppliers();

    expect(await screen.findByText("5 compras")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Registrar una factura" }),
    ).toHaveAttribute(
      "href",
      "/app/purchasing/purchases/new?supplierId=s1",
    );
  });
});
