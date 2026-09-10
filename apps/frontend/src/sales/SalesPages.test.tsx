import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/fixtures";
import { SalesPage } from "./SalesPages";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: () => true }),
}));

function stubSales(rows: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL | Request) => {
      const path = new URL(
        input instanceof Request ? input.url : input.toString(),
        "http://localhost",
      ).pathname;
      if (path === "/api/sales")
        return Promise.resolve(
          jsonResponse({
            data: rows,
            meta: { page: 1, limit: 20, total: rows.length, pages: 1 },
          }),
        );
      // customers / products used by the filter selectors
      return Promise.resolve(
        jsonResponse({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } }),
      );
    }),
  );
}

function renderSales(path = "/app/sales") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <SalesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

const baseSale = {
  documentDate: "2026-08-20T00:00:00.000Z",
  total: "100.00",
  status: "POSTED" as const,
  _count: { items: 2 },
};

describe("SalesPage", () => {
  it("shows an actionable empty state, not a bare 'no results'", async () => {
    stubSales([]);
    renderSales();
    expect(
      await screen.findByText("Todavía no registraste ventas"),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Registrar la primera venta" }),
    ).toBeVisible();
  });

  it("names who each sale is for in plain words", async () => {
    stubSales([
      { ...baseSale, id: "s1", number: 1 },
      {
        ...baseSale,
        id: "s2",
        number: 2,
        customer: { id: "c1", code: "CLI-001", name: "Taller El Progreso" },
      },
      { ...baseSale, id: "s3", number: 3, accountLabel: "Corolla azul – Juan" },
    ]);
    renderSales();

    const table = await screen.findByRole("region", {
      name: "Tabla desplazable",
    });
    expect(within(table).getByText("Mostrador")).toBeVisible();
    expect(within(table).getByText("Taller El Progreso")).toBeVisible();
    expect(
      within(table).getByText("Cliente registrado · CLI-001"),
    ).toBeVisible();
    expect(within(table).getByText("Corolla azul – Juan")).toBeVisible();
    expect(within(table).getByText("Cuenta abierta")).toBeVisible();
  });

  it("uses plain state labels in the filter, never raw DRAFT/POSTED", async () => {
    stubSales([]);
    renderSales();
    const statusSelect = await screen.findByLabelText("Estado");
    const labels = within(statusSelect)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(labels).toContain("Confirmada (ya descontó inventario)");
    expect(labels.some((l) => l === "POSTED" || l === "DRAFT")).toBe(false);
  });
});
