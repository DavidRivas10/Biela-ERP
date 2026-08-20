import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, systemHealth, testUser } from "../test/fixtures";
import type { AuthContextValue } from "../auth/AuthContext";
import { AppRoutes } from "./AppRoutes";

let auth: AuthContextValue;
vi.mock("../auth/AuthContext", () => ({ useAuth: () => auth }));

function renderRoute(path: string) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AppRoutes", () => {
  beforeEach(() => {
    auth = {
      status: "anonymous",
      user: null,
      permissions: new Set(),
      isAuthenticated: false,
      isInitializing: false,
      restoreError: null,
      login: vi.fn(),
      logout: vi.fn(),
      retryRestore: vi.fn(),
      hasPermission: vi.fn(() => false),
      hasAnyPermission: vi.fn(() => false),
      hasAllPermissions: vi.fn(() => false),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(systemHealth)),
    );
  });

  it("redirects an unauthenticated protected route to login", async () => {
    renderRoute("/app/products");
    expect(
      await screen.findByRole("heading", { name: "Iniciar sesión" }),
    ).toBeInTheDocument();
  });

  it("redirects an authenticated user without permission to forbidden", async () => {
    auth = {
      ...auth,
      status: "authenticated",
      user: { ...testUser, roles: [] },
    };
    renderRoute("/app/products");
    expect(
      await screen.findByText("No tienes permiso para ver esta sección"),
    ).toBeInTheDocument();
  });

  it("renders an authorized module placeholder transparently", async () => {
    auth = { ...auth, status: "authenticated", user: testUser };
    renderRoute("/app/products");
    expect(
      await screen.findByRole("heading", { name: "Productos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Módulo preparado para una fase posterior"),
    ).toBeInTheDocument();
  });

  it("renders the explicit not-found route", async () => {
    renderRoute("/unknown-path");
    expect(
      await screen.findByText("Esta página no existe"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir a iniciar sesión" }),
    ).toHaveAttribute("href", "/login");
  });
});
