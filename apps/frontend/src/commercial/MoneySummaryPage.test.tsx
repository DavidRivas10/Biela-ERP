import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, moneySummary } from "../test/fixtures";
import { MoneySummaryPage } from "./MoneySummaryPage";

afterEach(() => vi.unstubAllGlobals());

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MoneySummaryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MoneySummaryPage", () => {
  it("shows the three money buckets by method and the open Cash sessions", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(moneySummary))));
    renderPage();
    await screen.findByRole("heading", { name: "Vendido y cobrado el mismo día" });
    const cardFor = (heading: string) =>
      within(screen.getByRole("heading", { name: heading }).closest("section")!);

    const totalIn = (heading: string, amount: string) =>
      cardFor(heading).getByText(amount, {
        selector: ".money-summary-card__total",
      });

    expect(totalIn("Vendido y cobrado el mismo día", "L 85.00")).toBeInTheDocument();
    expect(cardFor("Vendido y cobrado el mismo día").getByText("Efectivo")).toBeInTheDocument();
    expect(totalIn("Cobrado de cuentas por cobrar", "L 40.00")).toBeInTheDocument();
    expect(cardFor("Cobrado de cuentas por cobrar").getByText("Transferencia")).toBeInTheDocument();
    expect(totalIn("Pagado a proveedores", "L 200.00")).toBeInTheDocument();
    expect(screen.getByText("CAJA-01")).toBeInTheDocument();
    expect(screen.getByText("L 585.00")).toBeInTheDocument(); // efectivo esperado
    expect(
      screen.getByText(/Rango mostrado: 19 ago 2026/),
    ).toBeInTheDocument();
  });

  it("has no open Cash sessions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ ...moneySummary, openCashSessions: [] }),
        ),
      ),
    );
    renderPage();

    expect(
      await screen.findByText("No hay sesiones de caja abiertas ahora"),
    ).toBeInTheDocument();
  });

  it("re-queries with the chosen date range", async () => {
    const fetchMock = vi.fn((url: string) => {
      void url;
      return Promise.resolve(jsonResponse(moneySummary));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Vendido y cobrado el mismo día" });

    await user.type(screen.getByLabelText("Desde"), "2026-08-01");
    await user.type(screen.getByLabelText("Hasta"), "2026-08-31");

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes("dateFrom=2026-08-01"),
        ),
      ).toBe(true),
    );
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("dateTo=2026-08-31"),
      ),
    ).toBe(true);

    await user.click(screen.getByRole("button", { name: "Volver a hoy" }));
    expect(screen.queryByDisplayValue("2026-08-01")).not.toBeInTheDocument();
  });

  it("surfaces a query failure with a retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ message: "Unavailable" }, 503)),
    );
    renderPage();

    expect(
      await screen.findByText("No se pudo cargar el resumen de dinero"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
  });
});
