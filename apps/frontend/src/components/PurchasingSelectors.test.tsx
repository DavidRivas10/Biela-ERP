import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/fixtures";
import {
  OpenCashSessionSelector,
  PaymentMethodSelector,
  SupplierSelector,
} from "./PurchasingSelectors";

const meta = (page: number, pages: number, total = 21) => ({
  page,
  limit: 20,
  total,
  pages,
});

function renderSelector(node: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {node}
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("Phase 12 bounded server selectors", () => {
  it("discovers a Supplier outside the initial page using server search", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      const target = url.searchParams.get("search") === "SUP-101";
      return Promise.resolve(
        jsonResponse({
          data: target
            ? [{ id: "supplier-101", code: "SUP-101", businessName: "Remoto" }]
            : [{ id: "supplier-1", code: "SUP-001", businessName: "Inicial" }],
          meta: meta(1, target ? 1 : 6, target ? 1 : 101),
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    function Harness() {
      const [value, setValue] = useState("");
      return (
        <>
          <SupplierSelector
            id="supplier"
            label="Proveedor"
            value={value}
            onChange={setValue}
          />
          <output>{value}</output>
        </>
      );
    }
    const user = userEvent.setup();
    renderSelector(<Harness />);
    expect(
      await screen.findByRole("option", { name: /SUP-001/ }),
    ).toBeVisible();
    await user.type(screen.getByRole("searchbox"), "SUP-101");
    const target = await screen.findByRole("option", { name: /SUP-101/ });
    await user.selectOptions(screen.getByLabelText("Proveedor"), target);
    expect(screen.getByText("supplier-101")).toBeVisible();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        new URL(
          input instanceof Request ? input.url : input.toString(),
        ).searchParams.has("search", "SUP-101"),
      ),
    ).toBe(true);
  });

  it("retrieves a Payment Method from a later server page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = new URL(
          input instanceof Request ? input.url : input.toString(),
        );
        const page = Number(url.searchParams.get("page"));
        return Promise.resolve(
          jsonResponse({
            data: [
              {
                id: page === 2 ? "method-21" : "method-1",
                name: page === 2 ? "Transferencia remota" : "Efectivo",
                kind: page === 2 ? "BANK_TRANSFER" : "CASH",
                active: true,
              },
            ],
            meta: meta(page, 2),
          }),
        );
      }),
    );
    function Harness() {
      const [value, setValue] = useState("");
      return (
        <>
          <PaymentMethodSelector
            id="method"
            label="Método"
            value={value}
            onChange={setValue}
          />
          <output>{value}</output>
        </>
      );
    }
    const user = userEvent.setup();
    renderSelector(<Harness />);
    expect(
      await screen.findByRole("option", { name: /Efectivo/ }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    const target = await screen.findByRole("option", { name: /remota/ });
    await user.selectOptions(screen.getByLabelText("Método"), target);
    expect(screen.getByText("method-21")).toBeVisible();
  });

  it("retrieves an OPEN Cash Session from a later server page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = new URL(
          input instanceof Request ? input.url : input.toString(),
        );
        const page = Number(url.searchParams.get("page"));
        return Promise.resolve(
          jsonResponse({
            data: [
              {
                id: page === 2 ? "session-21" : "session-1",
                status: "OPEN",
                cashRegister: {
                  code: page === 2 ? "CAJA-21" : "CAJA-01",
                  name: page === 2 ? "Caja remota" : "Caja principal",
                },
              },
            ],
            meta: meta(page, 2),
          }),
        );
      }),
    );
    function Harness() {
      const [value, setValue] = useState("");
      return (
        <>
          <OpenCashSessionSelector
            id="session"
            label="Sesión"
            value={value}
            onChange={setValue}
          />
          <output>{value}</output>
        </>
      );
    }
    const user = userEvent.setup();
    renderSelector(<Harness />);
    expect(
      await screen.findByRole("option", { name: /CAJA-01/ }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    const target = await screen.findByRole("option", { name: /CAJA-21/ });
    await user.selectOptions(screen.getByLabelText("Sesión"), target);
    expect(screen.getByText("session-21")).toBeVisible();
  });
});
