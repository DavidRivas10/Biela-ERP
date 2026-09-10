import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { commercialSummary, jsonResponse, testUser } from "../test/fixtures";
import type { CurrentUser } from "../types/api";
import { DashboardPage } from "./DashboardPage";

let currentUser: CurrentUser = testUser;
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: currentUser }),
}));

afterEach(() => vi.unstubAllGlobals());

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DashboardPage", () => {
  it("never calls system health and hides the summary without permission", async () => {
    currentUser = testUser; // products.read + inventory.read only
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);
    renderDashboard();

    await screen.findByText("No ves el resumen del día");
    expect(fetchMock).not.toHaveBeenCalled();
    // Quick actions are gated by permission: inventory yes, sales no.
    expect(
      screen.getByRole("link", { name: "Consultar inventario" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Registrar una venta" }),
    ).not.toBeInTheDocument();
  });

  it("shows an intentional loading state while the summary is pending", () => {
    currentUser = {
      ...testUser,
      roles: [
        { ...testUser.roles[0], permissions: ["commercial-summary.read"] },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    renderDashboard();
    expect(
      screen.getByText("Consultando el resumen del día"),
    ).toBeInTheDocument();
  });

  it("shows backend-derived commercial values when authorized", async () => {
    currentUser = {
      ...testUser,
      roles: [
        { ...testUser.roles[0], permissions: ["commercial-summary.read"] },
      ],
    };
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url.includes("commercial/summary")
          ? jsonResponse(commercialSummary)
          : jsonResponse({}),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderDashboard();

    await screen.findByText("L 1,360.00"); // vendido hoy
    expect(screen.getByText("L 800.00")).toBeInTheDocument(); // te deben
    expect(screen.getByText("L 475.50")).toBeInTheDocument(); // debes
    expect(
      screen.getByText(/Efectivo esperado en caja: L 250\.25/),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("/api/commercial/summary"),
      ),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("/api/system/health"),
      ),
    ).toBe(false);
  });

  it("surfaces a commercial query failure with a retry", async () => {
    currentUser = {
      ...testUser,
      roles: [
        { ...testUser.roles[0], permissions: ["commercial-summary.read"] },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ message: "Unavailable" }, 503)),
    );
    renderDashboard();

    expect(
      await screen.findByText("El resumen comercial no está disponible"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
  });
});
