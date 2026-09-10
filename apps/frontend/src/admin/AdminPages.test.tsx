import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthContextValue } from "../auth/AuthContext";
import { jsonResponse, testUser } from "../test/fixtures";
import {
  RoleDetailPage,
  RoleFormPage,
  UserDetailPage,
  UserFormPage,
} from "./AdminPages";

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
    expect(screen.getByRole("button", { name: "Quitar acceso" })).toBeVisible();
    expect(screen.queryByText(/passwordHash/i)).toBeNull();
  });

  it("reveals an admin-reset temporary password once, only after the action", async () => {
    permissions = new Set(["users.update"]);
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === "/api/users/user-2/reset-password" && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse({ user, temporaryPassword: "Kp7Rm2Ns8Vt4Wq9x" }),
        );
      }
      return Promise.resolve(jsonResponse(user));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderRoute("/app/admin/users/user-2", "/app/admin/users/:id", <UserDetailPage />);
    await screen.findByRole("heading", { name: "Carmen Díaz" });

    // nothing sensitive is on screen before the admin acts
    expect(screen.queryByText("Kp7Rm2Ns8Vt4Wq9x")).toBeNull();
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "POST"),
    ).toBe(false);

    await userEvent.click(
      screen.getByRole("button", { name: "Restablecer contraseña" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Generar contraseña temporal" }),
    );

    expect(await screen.findByText("Kp7Rm2Ns8Vt4Wq9x")).toBeVisible();
    expect(
      screen.getByRole("alertdialog", { name: /Contraseña temporal/i }),
    ).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Listo" }));
    expect(screen.queryByText("Kp7Rm2Ns8Vt4Wq9x")).toBeNull();
  });

  it("displays exact permissions grouped without renaming codes", async () => {
    permissions = new Set(["roles.read"]);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(role))));
    renderRoute("/app/admin/roles/role-1", "/app/admin/roles/:id", <RoleDetailPage />);
    expect(await screen.findByText("cash-sessions.read")).toBeVisible();
    expect(screen.getByText("cash-movements.read")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Editar" })).toBeNull();
  });

  it("groups the user form into named sections", async () => {
    permissions = new Set(["users.create"]);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse([role]))));
    renderRoute("/app/admin/users/new", "/app/admin/users/new", <UserFormPage />);
    expect(
      await screen.findByRole("group", { name: "Datos de la persona" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "¿Qué puede hacer? (roles)" }),
    ).toBeInTheDocument();
  });

  it("shows a live permission count in the role form", async () => {
    permissions = new Set(["roles.manage"]);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse([]))));
    renderRoute("/app/admin/roles/new", "/app/admin/roles/new", <RoleFormPage />);
    expect(
      screen.getByText(/Permisos · 0 de \d+ marcados/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/Crear productos/));
    expect(
      screen.getByText(/Permisos · 1 de \d+ marcados/),
    ).toBeInTheDocument();
  });
});
