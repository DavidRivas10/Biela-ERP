import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/fixtures";
import { ReceivablesPage } from "./ReceivablesPage";

let permits: string[] = [];
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: (p: string) => permits.includes(p) }),
}));

const summary = {
  documentCount: 2,
  grossAmount: "0.00",
  returnAmount: "0.00",
  netAmount: "0.00",
  paidAmount: "0.00",
  refundedAmount: "0.00",
  outstandingAmount: "800.00",
  creditAmount: "0.00",
  unpaidCount: 1,
  partiallyPaidCount: 1,
  paidCount: 0,
  overdueCount: 1,
  overdueAmount: "300.00",
  oldestDueDate: null,
};

function stub(rows: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          data: rows,
          meta: { page: 1, limit: 20, total: rows.length, pages: 1 },
          summary,
          businessDate: "2026-09-08",
        }),
      ),
    ),
  );
}

function renderPage() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/app/commercial/receivables"]}>
        <ReceivablesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("ReceivablesPage", () => {
  it("has no help-note; explains the terms in the description and shows key totals", async () => {
    permits = ["commercial-receivables.read"];
    stub([]);
    renderPage();
    expect(
      await screen.findByText("Te deben en total"),
    ).toBeVisible();
    expect(
      screen.getByText(/Lo que tus clientes te deben/),
    ).toBeVisible();
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.getByText("L 800.00")).toBeVisible();
    expect(screen.getByText("No te deben nada")).toBeVisible();
  });

  it("gives each debt a plain overdue label and a direct 'Cobrar' action", async () => {
    permits = ["commercial-receivables.read", "payments.create"];
    stub([
      {
        id: "sale-7",
        number: 7,
        walkIn: false,
        customer: { id: "c1", code: "CLI-001", name: "Taller El Progreso" },
        documentDate: "2026-08-01",
        paymentDueDate: "2026-08-15",
        total: "500.00",
        outstandingAmount: "200.00",
        paidAmount: "300.00",
        refundedAmount: "0.00",
        settlementStatus: "PARTIALLY_PAID",
        overdue: true,
        ageInDays: 24,
      },
    ]);
    renderPage();

    const table = await screen.findByRole("region", {
      name: "Tabla desplazable",
    });
    expect(within(table).getByText("Taller El Progreso")).toBeVisible();
    expect(within(table).getByText("Vencida hace 24 días")).toBeVisible();
    expect(within(table).getByText("Pago parcial")).toBeVisible();
    expect(
      within(table).getByRole("link", { name: "Cobrar" }),
    ).toHaveAttribute("href", "/app/sales/sale-7/payments");
  });
});
