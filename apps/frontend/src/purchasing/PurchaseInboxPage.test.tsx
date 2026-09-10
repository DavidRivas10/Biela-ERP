import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/fixtures";
import { PurchaseInboxPage } from "./PurchaseInboxPage";

let permits: string[] = [];
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: (p: string) => permits.includes(p) }),
}));

const supplier = {
  id: "sup-1",
  code: "SUP-001",
  businessName: "Repuestos del Sur",
  active: true,
};
function purchase(id: string, number: number, status: string) {
  return {
    id,
    number,
    status,
    supplierId: "sup-1",
    supplier,
    supplierDocumentNumber: `FAC-${number}`,
    documentDate: "2026-09-01T00:00:00.000Z",
    total: "500.00",
    subtotal: "500.00",
    discountTotal: "0.00",
    taxTotal: "0.00",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function stub() {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL | Request) => {
      const path = new URL(
        input instanceof Request ? input.url : input.toString(),
        "http://localhost",
      ).pathname;
      if (path === "/api/purchases")
        return Promise.resolve(
          jsonResponse({
            data: [
              purchase("p1", 11, "DRAFT"),
              purchase("p2", 12, "CONFIRMED"),
              purchase("p3", 13, "RECEIVED"),
            ],
            meta: { page: 1, limit: 50, total: 3, pages: 1 },
          }),
        );
      if (path === "/api/commercial/payables")
        return Promise.resolve(
          jsonResponse({
            data: [
              {
                id: "p3",
                number: 13,
                supplierId: "sup-1",
                supplier,
                outstandingAmount: "200.00",
                overdue: true,
                ageInDays: 5,
                settlementStatus: "PARTIALLY_PAID",
                documentDate: "2026-09-01",
              },
            ],
            meta: { page: 1, limit: 20, total: 1, pages: 1 },
            summary: {},
            businessDate: "2026-09-08",
          }),
        );
      return Promise.resolve(jsonResponse({}));
    }),
  );
}

function renderInbox() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/app/purchasing/inbox"]}>
        <PurchaseInboxPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("PurchaseInboxPage", () => {
  it("buckets purchases by the next action the admin has to take", async () => {
    permits = [
      "purchases.read",
      "purchases.receive",
      "purchases.pay",
      "commercial-payables.read",
      "purchases.create",
    ];
    stub();
    renderInbox();

    await screen.findByText("Compra #11");
    const confirm = screen
      .getByRole("heading", { name: "Por confirmar" })
      .closest("section")!;
    expect(within(confirm).getByText("Compra #11")).toBeVisible();
    expect(
      within(confirm).getByRole("link", { name: "Revisar y confirmar" }),
    ).toHaveAttribute("href", "/app/purchasing/purchases/p1");

    const receive = screen
      .getByRole("heading", { name: "Esperando mercadería" })
      .closest("section")!;
    expect(
      within(receive).getByRole("link", { name: "Recibir mercadería" }),
    ).toHaveAttribute("href", "/app/purchasing/purchases/p2/receipts");

    const pay = (
      await screen.findByRole("heading", { name: "Por pagar" })
    ).closest("section")!;
    await within(pay).findByText(/debe L 200\.00/);
    expect(within(pay).getByText(/debe L 200\.00/)).toBeVisible();
    expect(
      within(pay).getByRole("link", { name: "Pagar" }),
    ).toHaveAttribute("href", "/app/purchasing/purchases/p3/payments");
  });

  it("hides the payables section without permission", async () => {
    permits = ["purchases.read", "purchases.receive"];
    stub();
    renderInbox();
    await screen.findByRole("heading", { name: "Por confirmar" });
    expect(
      screen.queryByRole("heading", { name: "Por pagar" }),
    ).toBeNull();
  });
});
