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
      vi.fn((input: string | URL | Request) => {
        const path = new URL(
          input instanceof Request ? input.url : input.toString(),
        ).pathname;
        if (
          path === "/api/product-categories" ||
          path === "/api/product-brands"
        )
          return Promise.resolve(jsonResponse([]));
        if (path === "/api/products")
          return Promise.resolve(
            jsonResponse({
              data: [],
              meta: { page: 1, limit: 20, total: 0, pages: 0 },
            }),
          );
        if (path === "/api/suppliers")
          return Promise.resolve(
            jsonResponse({
              data: [],
              meta: { page: 1, limit: 20, total: 0, pages: 0 },
            }),
          );
        if (path === "/api/commercial/payables")
          return Promise.resolve(
            jsonResponse({
              data: [],
              meta: { page: 1, limit: 20, total: 0, pages: 0 },
              summary: {
                documentCount: 0,
                grossAmount: "0.00",
                returnAmount: "0.00",
                netAmount: "0.00",
                paidAmount: "0.00",
                refundedAmount: "0.00",
                outstandingAmount: "0.00",
                creditAmount: "0.00",
                unpaidCount: 0,
                partiallyPaidCount: 0,
                paidCount: 0,
                overdueCount: 0,
                overdueAmount: "0.00",
                oldestDueDate: null,
              },
              businessDate: "2026-08-20",
            }),
          );
        return Promise.resolve(jsonResponse(systemHealth));
      }),
    );
  });

  it("redirects an unauthenticated protected route to login", async () => {
    renderRoute("/app/purchasing/suppliers");
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
    renderRoute("/app/purchasing/purchases");
    expect(
      await screen.findByText("No tienes permiso para ver esta sección"),
    ).toBeInTheDocument();
  });

  it("renders an authorized Phase 12 Supplier route", async () => {
    auth = {
      ...auth,
      status: "authenticated",
      user: {
        ...testUser,
        roles: [
          {
            id: "purchasing-role",
            name: "purchasing",
            permissions: ["suppliers.read"],
          },
        ],
      },
    };
    renderRoute("/app/purchasing/suppliers");
    expect(
      await screen.findByRole("heading", { name: "Proveedores" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("No se encontraron proveedores"),
    ).toBeInTheDocument();
  });

  it("protects global Payables with commercial-payables.read", async () => {
    auth = {
      ...auth,
      status: "authenticated",
      user: {
        ...testUser,
        roles: [
          {
            id: "payables-role",
            name: "payables-reader",
            permissions: ["commercial-payables.read"],
          },
        ],
      },
    };
    renderRoute("/app/commercial/payables");
    expect(
      await screen.findByRole("heading", { name: "Cuentas por pagar" }),
    ).toBeInTheDocument();
  });

  it("renders the authorized operational products page", async () => {
    auth = { ...auth, status: "authenticated", user: testUser };
    renderRoute("/app/products");
    expect(
      await screen.findByRole("heading", { name: "Productos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Datos maestros de producto; el inventario se administra por ubicación.",
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("No se encontraron productos"),
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
