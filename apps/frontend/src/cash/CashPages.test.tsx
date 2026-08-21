import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContextValue } from "../auth/AuthContext";
import { jsonResponse, testUser } from "../test/fixtures";
import { CashSessionDetailPage, CashMovementsPage } from "./CashPages";

let permissions = new Set<string>();
vi.mock("../auth/AuthContext", () => ({
  useAuth: (): AuthContextValue => ({
    status: "authenticated", user: testUser, permissions,
    isAuthenticated: true, isInitializing: false, restoreError: null,
    login: vi.fn(), logout: vi.fn(), retryRestore: vi.fn(),
    hasPermission: (permission) => permissions.has(permission),
    hasAnyPermission: (items) => items.some((item) => permissions.has(item)),
    hasAllPermissions: (items) => items.every((item) => permissions.has(item)),
  }),
}));

const register = { id: "register-1", code: "CAJA-01", name: "Principal", active: true, createdAt: "2026-08-20T12:00:00Z", updatedAt: "2026-08-20T12:00:00Z" };
const session = { id: "session-1", cashRegisterId: register.id, cashRegister: register, status: "OPEN", openingAmount: "100.00", openedByActorId: "actor-1", openedAt: "2026-08-20T12:00:00Z", createdAt: "2026-08-20T12:00:00Z", updatedAt: "2026-08-20T12:00:00Z", movements: [], movementTotals: {}, expectedCash: "135.25", paymentTotalsByMethod: [] };
const movement = { id: "movement-1", cashSessionId: session.id, cashSession: session, type: "MANUAL_IN", amount: "35.25", reason: "Fondo", actorId: "actor-1", createdAt: "2026-08-20T13:00:00Z" };
const meta = { page: 1, limit: 20, total: 1, pages: 1 };

function renderRoute(path: string, route: string, node: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={node} /></Routes></MemoryRouter></QueryClientProvider>);
}
function installFetch(status: "OPEN" | "CLOSED" = "OPEN") {
  const fetchMock = vi.fn((input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname.endsWith("/summary")) return Promise.resolve(jsonResponse({ ...session, status, countedAmount: status === "CLOSED" ? "135.25" : null, differenceAmount: status === "CLOSED" ? "0.00" : null, closedAt: status === "CLOSED" ? "2026-08-20T14:00:00Z" : null }));
    if (url.pathname === "/api/cash-sessions/session-1") return Promise.resolve(jsonResponse({ ...session, status, expectedAmount: status === "CLOSED" ? "135.25" : null, countedAmount: status === "CLOSED" ? "135.25" : null, differenceAmount: status === "CLOSED" ? "0.00" : null, closedAt: status === "CLOSED" ? "2026-08-20T14:00:00Z" : null }));
    if (url.pathname === "/api/cash-movements") return Promise.resolve(jsonResponse({ data: [movement], meta: { ...meta, page: Number(url.searchParams.get("page") ?? 1), total: 21, pages: 2 } }));
    if (url.pathname === "/api/cash-registers") return Promise.resolve(jsonResponse({ data: [register], meta }));
    return Promise.resolve(jsonResponse({}));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
beforeEach(() => { permissions = new Set(); });
afterEach(() => vi.unstubAllGlobals());

describe("Cash operational screens", () => {
  it("shows backend expected Cash and paginated movement history", async () => {
    permissions = new Set(["cash-movements.read"]);
    const fetchMock = installFetch();
    renderRoute("/app/cash/sessions/session-1", "/app/cash/sessions/:id", <CashSessionDetailPage />);
    expect(await screen.findByText("L 135.25")).toBeVisible();
    expect(await screen.findByText("Entrada manual")).toBeVisible();
    expect(fetchMock.mock.calls.some(([input]) => new URL(input instanceof Request ? input.url : input.toString()).searchParams.get("includeMovements") === "false")).toBe(true);
    expect(screen.queryByRole("heading", { name: "Movimiento manual" })).toBeNull();
  });

  it("exposes manual and close controls only under their exact permissions", async () => {
    permissions = new Set(["cash-movements.create", "cash-sessions.close"]);
    installFetch();
    renderRoute("/app/cash/sessions/session-1", "/app/cash/sessions/:id", <CashSessionDetailPage />);
    expect(await screen.findByRole("heading", { name: "Movimiento manual" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Cerrar sesión" })).toBeVisible();
  });

  it("keeps a CLOSED session read-only", async () => {
    permissions = new Set(["cash-movements.create", "cash-sessions.close"]);
    installFetch("CLOSED");
    renderRoute("/app/cash/sessions/session-1", "/app/cash/sessions/:id", <CashSessionDetailPage />);
    expect(await screen.findByText("Cerrada")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Movimiento manual" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Cerrar sesión" })).toBeNull();
  });

  it("reaches Cash Movements beyond the first page", async () => {
    const user = userEvent.setup();
    const fetchMock = installFetch();
    renderRoute("/app/cash/movements", "/app/cash/movements", <CashMovementsPage />);
    await screen.findByText("Fondo");
    const next = screen.getAllByRole("button", { name: "Siguiente" }).find((button) => !button.hasAttribute("disabled"));
    if (!next) throw new Error("Expected enabled next-page control");
    await user.click(next);
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => new URL(input instanceof Request ? input.url : input.toString()).searchParams.get("page") === "2")).toBe(true));
  });
});
