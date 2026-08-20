import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  commercialSummary,
  jsonResponse,
  systemHealth,
  testUser,
} from "../test/fixtures";
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
  it("requests health but never requests commercial summary without permission", async () => {
    currentUser = testUser;
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(systemHealth));
    vi.stubGlobal("fetch", fetchMock);
    renderDashboard();

    await screen.findByText("API Gateway");
    expect(
      screen.getByText("Resumen comercial restringido"),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/system/health");
    expect(screen.getByRole("link", { name: /Productos/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Ventas/ }),
    ).not.toBeInTheDocument();
  });

  it("shows an intentional loading state while health is pending", () => {
    currentUser = testUser;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    renderDashboard();
    expect(screen.getByText("Consultando servicios")).toBeInTheDocument();
  });

  it("labels a degraded backend response without hiding service detail", async () => {
    currentUser = testUser;
    const degraded = {
      ...systemHealth,
      status: "degraded" as const,
      services: {
        ...systemHealth.services,
        users: { status: "error" as const, service: "ms-users" },
      },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(degraded)));
    renderDashboard();

    expect(await screen.findByText("Sistema degradado")).toBeInTheDocument();
    expect(screen.getByText("No disponible")).toBeInTheDocument();
  });

  it("shows a retryable health error", async () => {
    currentUser = testUser;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ message: "Unavailable" }, 503)),
    );
    renderDashboard();

    expect(
      await screen.findByText(
        "No pudimos consultar el estado del sistema",
        undefined,
        { timeout: 3_000 },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
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
        jsonResponse(
          url.includes("commercial/summary") ? commercialSummary : systemHealth,
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderDashboard();

    await screen.findByText("L 800.00");
    expect(screen.getByText("L 475.50")).toBeInTheDocument();
    expect(screen.getByText("L 250.25")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("/api/commercial/summary"),
      ),
    ).toBe(true);
  });

  it("surfaces a commercial query failure without hiding system health", async () => {
    currentUser = {
      ...testUser,
      roles: [
        { ...testUser.roles[0], permissions: ["commercial-summary.read"] },
      ],
    };
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url.includes("commercial/summary")
          ? jsonResponse({ message: "Unavailable" }, 503)
          : jsonResponse(systemHealth),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderDashboard();

    await screen.findByText("El resumen comercial no está disponible");
    await waitFor(() =>
      expect(screen.getByText("API Gateway")).toBeInTheDocument(),
    );
  });
});
