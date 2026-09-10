import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/fixtures";
import { CustomersPage } from "./CustomerPages";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: () => true }),
}));

function stubCustomers(rows: unknown[]) {
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

function renderCustomers(path = "/app/sales/customers") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <CustomersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("CustomersPage", () => {
  it("explains when to register a customer instead of just selling", async () => {
    stubCustomers([]);
    renderCustomers();
    expect(
      await screen.findByText("Todavía no hay clientes registrados"),
    ).toBeVisible();
    expect(
      screen.getAllByText(
        /Para una venta de mostrador que se paga en el momento, no hace falta/,
      ).length,
    ).toBeGreaterThan(0);
  });

  it("shows each customer's sales count and a direct 'sell to' action", async () => {
    stubCustomers([
      {
        id: "c1",
        code: "TALLER-PROGRESO",
        name: "Taller El Progreso",
        active: true,
        _count: { sales: 4 },
      },
      {
        id: "c2",
        code: "NUEVO",
        name: "Cliente Nuevo",
        active: true,
        _count: { sales: 0 },
      },
    ]);
    renderCustomers();

    expect(await screen.findByText("4 ventas")).toBeVisible();
    expect(screen.getByText("Sin ventas aún")).toBeVisible();
    const sellLinks = screen.getAllByRole("link", {
      name: "Vender a este cliente",
    });
    expect(sellLinks[0]).toHaveAttribute(
      "href",
      "/app/sales/new?customerId=c1",
    );
  });
});
