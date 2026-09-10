import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/fixtures";
import { PosPage } from "./PosPage";

let permits: string[] = [];
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: (p: string) => permits.includes(p) }),
}));

function stub(handlers: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL | Request) => {
      const path = new URL(
        input instanceof Request ? input.url : input.toString(),
        "http://localhost",
      ).pathname;
      for (const [key, value] of Object.entries(handlers)) {
        if (path === key || path.startsWith(key))
          return Promise.resolve(jsonResponse(value));
      }
      return Promise.resolve(jsonResponse({}));
    }),
  );
}

function renderPos() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/app/pos"]}>
        <PosPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  try {
    localStorage.clear();
  } catch {
    /* noop */
  }
});

const ALL = [
  "cash-registers.read",
  "cash-sessions.read",
  "cash-sessions.open",
  "cash-sessions.close",
  "cash-movements.read",
  "sales.read",
  "sales.create",
  "payments.create",
];

describe("PosPage", () => {
  it("explains what a cash session is, in plain words", async () => {
    permits = ALL;
    stub({
      "/api/cash-registers": {
        data: [{ id: "r1", code: "MOS-01", name: "Mostrador", active: true }],
        meta: { page: 1, limit: 50, total: 1, pages: 1 },
      },
      "/api/cash-registers/r1/current-session": {},
      "/api/sales": { data: [], meta: { page: 1, limit: 8, total: 0, pages: 0 } },
      "/api/commercial/receivables": {
        data: [],
        meta: { page: 1, limit: 8, total: 0, pages: 0 },
        summary: {},
        businessDate: "2026-09-08",
      },
    });
    renderPos();
    expect(
      await screen.findByText(/Una sesión de caja es tu turno/),
    ).toBeVisible();
  });

  it("offers to open the shift when the single register has no open session", async () => {
    permits = ALL;
    stub({
      "/api/cash-registers": {
        data: [{ id: "r1", code: "MOS-01", name: "Mostrador", active: true }],
        meta: { page: 1, limit: 50, total: 1, pages: 1 },
      },
      "/api/cash-registers/r1/current-session": {},
      "/api/sales": { data: [], meta: { page: 1, limit: 8, total: 0, pages: 0 } },
      "/api/commercial/receivables": {
        data: [],
        meta: { page: 1, limit: 8, total: 0, pages: 0 },
        summary: {},
        businessDate: "2026-09-08",
      },
    });
    renderPos();
    expect(await screen.findByText("Abrí tu caja")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Abrir caja" }),
    ).toBeInTheDocument();
  });

  it("lists sales still to collect with a direct 'Cobrar' action", async () => {
    permits = ALL;
    stub({
      "/api/cash-registers": {
        data: [{ id: "r1", code: "MOS-01", name: "Mostrador", active: true }],
        meta: { page: 1, limit: 50, total: 1, pages: 1 },
      },
      "/api/cash-registers/r1/current-session": {
        id: "s1",
        status: "OPEN",
        openedAt: "2026-09-08T12:00:00.000Z",
        openingAmount: "500.00",
        cashRegisterId: "r1",
        cashRegister: { id: "r1", code: "MOS-01", name: "Mostrador" },
      },
      "/api/cash-sessions/s1/summary": {
        expectedCash: "1250.00",
        movementTotals: {},
      },
      "/api/commercial/receivables": {
        data: [
          {
            id: "sale-9",
            number: 9,
            walkIn: true,
            total: "300.00",
            outstandingAmount: "120.00",
            paidAmount: "180.00",
            refundedAmount: "0.00",
            settlementStatus: "PARTIALLY_PAID",
            overdue: false,
            ageInDays: 1,
            documentDate: "2026-09-07",
          },
        ],
        meta: { page: 1, limit: 8, total: 1, pages: 1 },
        summary: {},
        businessDate: "2026-09-08",
      },
      "/api/sales": { data: [], meta: { page: 1, limit: 8, total: 0, pages: 0 } },
    });
    renderPos();
    expect(await screen.findByText(/Venta #9/)).toBeVisible();
    expect(
      screen.getByText(/Debe L 120\.00 de L 300\.00/),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Cobrar" }),
    ).toHaveAttribute("href", "/app/sales/sale-9/payments");
  });
});
