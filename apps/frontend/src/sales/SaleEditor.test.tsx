import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContextValue } from "../auth/AuthContext";
import { jsonResponse, testUser } from "../test/fixtures";
import { SaleFormPage } from "./SalesPages";

let auth: AuthContextValue;
vi.mock("../auth/AuthContext", () => ({ useAuth: () => auth }));

const emptyMeta = { page: 1, limit: 20, total: 0, pages: 0 };
const otherAccount = {
  id: "sale-2",
  number: 202,
  accountLabel: "Sentra gris – María",
  status: "DRAFT",
  total: "540.00",
  _count: { items: 3 },
};

function stubFetch(rows: unknown[] = [otherAccount]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL | Request) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
        "http://localhost",
      );
      if (url.pathname === "/api/sales")
        return Promise.resolve(
          jsonResponse({ data: rows, meta: emptyMeta }),
        );
      return Promise.resolve(jsonResponse({ data: [], meta: emptyMeta }));
    }),
  );
}

function renderNewAccount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/app/sales/new?mode=cuenta"]}>
        <Routes>
          <Route path="/app/sales/new" element={<SaleFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  auth = {
    status: "authenticated",
    user: testUser,
    permissions: new Set(),
    isAuthenticated: true,
    isInitializing: false,
    restoreError: null,
    login: vi.fn(),
    logout: vi.fn(),
    retryRestore: vi.fn(),
    hasPermission: vi.fn(() => true),
    hasAnyPermission: vi.fn(() => true),
    hasAllPermissions: vi.fn(() => true),
  };
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Open accounts (cuenta abierta) — tabs and local recovery", () => {
  it("shows the other open accounts as tabs, plus a tab to start a new one", async () => {
    stubFetch();
    renderNewAccount();

    expect(
      await screen.findByRole("tab", { name: /Sentra gris – María/ }),
    ).toBeVisible();
    expect(
      screen.getByRole("tab", { name: "+ Nueva cuenta" }),
    ).toBeVisible();
  });

  it("autosaves the in-progress account to localStorage", async () => {
    stubFetch([]);
    renderNewAccount();

    // The "cuenta" fields render synchronously (a brand-new account has no
    // server detail to await), so no fake timers are needed until we get to
    // the debounce itself.
    const label = screen.getByLabelText(/^Etiqueta de la cuenta/);

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.change(label, { target: { value: "Corolla azul" } });
    await vi.advanceTimersByTimeAsync(700);

    const raw = localStorage.getItem("sale-draft:new");
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw!) as { data: { accountLabel: string } };
    expect(saved.data.accountLabel).toBe("Corolla azul");
  });

  it("offers to restore an autosaved draft and fills the form on demand", async () => {
    localStorage.setItem(
      "sale-draft:new",
      JSON.stringify({
        data: {
          mode: "cuenta",
          customerId: "",
          accountLabel: "Hilux blanca – Pedro",
          documentDate: "2026-09-09",
          paymentDueDate: "",
          notes: "",
          lines: [
            {
              key: 1,
              productId: "",
              sourceLocationId: "",
              quantity: "1",
              unitPrice: "",
              discountAmount: "0.00",
              taxAmount: "0.00",
            },
          ],
        },
        savedAt: new Date().toISOString(),
      }),
    );
    stubFetch([]);
    const user = userEvent.setup();
    renderNewAccount();

    expect(
      screen.getByText("Hay cambios sin guardar de antes"),
    ).toBeVisible();
    expect(screen.queryByDisplayValue("Hilux blanca – Pedro")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Restaurar" }));

    expect(screen.getByDisplayValue("Hilux blanca – Pedro")).toBeVisible();
    expect(
      screen.queryByText("Hay cambios sin guardar de antes"),
    ).toBeNull();
  });

  it("discards a saved draft without applying it", async () => {
    localStorage.setItem(
      "sale-draft:new",
      JSON.stringify({
        data: {
          mode: "cuenta",
          customerId: "",
          accountLabel: "Hilux blanca – Pedro",
          documentDate: "2026-09-09",
          paymentDueDate: "",
          notes: "",
          lines: [],
        },
        savedAt: new Date().toISOString(),
      }),
    );
    stubFetch([]);
    const user = userEvent.setup();
    renderNewAccount();

    screen.getByText("Hay cambios sin guardar de antes");
    await user.click(screen.getByRole("button", { name: "Descartar" }));

    expect(
      screen.queryByText("Hay cambios sin guardar de antes"),
    ).toBeNull();
    expect(localStorage.getItem("sale-draft:new")).toBeNull();
    expect(screen.queryByDisplayValue("Hilux blanca – Pedro")).toBeNull();
  });
});
