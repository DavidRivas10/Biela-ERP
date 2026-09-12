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

/** Every tab panel stays mounted at all times — only the active one lacks
 * `hidden`. Grabbing them by id works regardless of which tab is selected. */
function panel(key: string) {
  return document.getElementById(`money-summary-panel-${key}`) as HTMLElement;
}

function moneyTab(name: string) {
  return screen.getByRole("tab", { name });
}

describe("MoneySummaryPage", () => {
  it("defaults to the first tab, full width, with the other three mounted but hidden", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(moneySummary))));
    renderPage();

    expect(panel("same-day")).not.toHaveAttribute("hidden");
    expect(panel("receivables")).toHaveAttribute("hidden");
    expect(panel("purchases")).toHaveAttribute("hidden");
    expect(panel("cash-sessions")).toHaveAttribute("hidden");

    expect(
      await within(panel("same-day")).findByText("L 85.00", {
        selector: ".sale-totals-bar__amount",
      }),
    ).toBeInTheDocument();
    expect(within(panel("same-day")).getByText("Efectivo")).toBeInTheDocument();
  });

  it("switching tabs never resets another tab's own date filter", async () => {
    const fetchMock = vi.fn((url: string) => {
      void url;
      return Promise.resolve(jsonResponse(moneySummary));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();
    await within(panel("same-day")).findByRole("heading", {
      name: "Vendido y cobrado el mismo día",
    });

    // Set a custom range on the first tab.
    await user.type(within(panel("same-day")).getByLabelText("Desde"), "2026-08-01");
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes("dateFrom=2026-08-01"),
        ),
      ).toBe(true),
    );

    // Jump to Cobrado de cuentas por cobrar and back — its own filter is
    // untouched, and it defaulted independently (no dateFrom of its own).
    await user.click(moneyTab("Cobrado de cuentas por cobrar"));
    expect(panel("same-day")).toHaveAttribute("hidden");
    expect(panel("receivables")).not.toHaveAttribute("hidden");
    expect(
      within(panel("receivables")).getByLabelText<HTMLInputElement>("Desde")
        .value,
    ).toBe("");

    await user.click(moneyTab("Vendido y cobrado el mismo día"));
    expect(
      within(panel("same-day")).getByLabelText<HTMLInputElement>("Desde")
        .value,
    ).toBe("2026-08-01");
  });

  it("shows the fourth tab's open Cash sessions, unaffected by any date filter", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(moneySummary))));
    const user = userEvent.setup();
    renderPage();
    await within(panel("same-day")).findByRole("heading", {
      name: "Vendido y cobrado el mismo día",
    });

    await user.click(moneyTab("Efectivo esperado por caja abierta"));
    expect(panel("cash-sessions")).not.toHaveAttribute("hidden");
    expect(within(panel("cash-sessions")).queryByLabelText("Desde")).toBeNull();
    expect(
      await within(panel("cash-sessions")).findByText("CAJA-01"),
    ).toBeInTheDocument();
    expect(within(panel("cash-sessions")).getByText("L 585.00")).toBeInTheDocument();
  });

  it("has no open Cash sessions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(jsonResponse({ ...moneySummary, openCashSessions: [] })),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await within(panel("same-day")).findByRole("heading", {
      name: "Vendido y cobrado el mismo día",
    });
    await user.click(moneyTab("Efectivo esperado por caja abierta"));

    expect(
      await within(panel("cash-sessions")).findByText(
        "No hay sesiones de caja abiertas ahora",
      ),
    ).toBeInTheDocument();
  });

  it("surfaces a query failure with a retry on each tab independently", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ message: "Unavailable" }, 503)),
    );
    renderPage();

    expect(
      await within(panel("same-day")).findByText("No se pudo cargar este total"),
    ).toBeInTheDocument();
    expect(
      within(panel("same-day")).getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
  });
});
