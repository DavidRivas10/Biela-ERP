import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthContextValue } from "../auth/AuthContext";
import { jsonResponse, testUser } from "../test/fixtures";
import { RoleDetailPage, UserDetailPage } from "./AdminPages";

let permissions = new Set<string>();
vi.mock("../auth/AuthContext", () => ({ useAuth: (): AuthContextValue => ({ status: "authenticated", user: testUser, permissions, isAuthenticated: true, isInitializing: false, restoreError: null, login: vi.fn(), logout: vi.fn(), retryRestore: vi.fn(), hasPermission: (permission) => permissions.has(permission), hasAnyPermission: () => false, hasAllPermissions: () => false }) }));
const user = { id: "user-2", email: "caja@example.com", firstName: "Carmen", lastName: "Díaz", active: true, roles: [{ id: "role-1", name: "cashier", permissions: ["cash-sessions.read", "cash-movements.read"] }] };
const role = { _id: "role-1", name: "cashier", description: "Operador de caja", permissions: ["cash-sessions.read", "cash-movements.read"], active: true };
function renderRoute(path: string, route: string, node: React.ReactNode) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={node} /></Routes></MemoryRouter></QueryClientProvider>); }
afterEach(() => vi.unstubAllGlobals());

describe("Users and Roles screens", () => {
  it("never renders credential hashes and gates lifecycle actions", async () => {
    permissions = new Set(["users.deactivate"]);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(user))));
    renderRoute("/app/admin/users/user-2", "/app/admin/users/:id", <UserDetailPage />);
    expect(await screen.findByRole("heading", { name: "Carmen Díaz" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Desactivar" })).toBeVisible();
    expect(screen.queryByText(/passwordHash/i)).toBeNull();
  });

  it("displays exact permissions grouped without renaming codes", async () => {
    permissions = new Set(["roles.read"]);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(role))));
    renderRoute("/app/admin/roles/role-1", "/app/admin/roles/:id", <RoleDetailPage />);
    expect(await screen.findByText("cash-sessions.read")).toBeVisible();
    expect(screen.getByText("cash-movements.read")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Editar" })).toBeNull();
  });
});
