import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/fixtures";
import { CashRegisterSelector } from "./CashAdminSelectors";

afterEach(() => vi.unstubAllGlobals());

describe("Phase 10.E scalable selectors", () => {
  it("discovers and selects a Cash Register outside the default page through server search", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      const target = url.searchParams.get("search") === "CAJA-101";
      return Promise.resolve(jsonResponse({
        data: target
          ? [{ id: "register-101", code: "CAJA-101", name: "Caja remota", active: true }]
          : [{ id: "register-1", code: "CAJA-001", name: "Caja inicial", active: true }],
        meta: { page: 1, limit: 20, total: target ? 1 : 101, pages: target ? 1 : 6 },
      }));
    });
    vi.stubGlobal("fetch", fetchMock);
    function Harness() {
      const [value, setValue] = useState("");
      return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CashRegisterSelector id="register" value={value} onChange={setValue} /><output>{value}</output></QueryClientProvider>;
    }
    const user = userEvent.setup();
    render(<Harness />);
    expect(await screen.findByRole("option", { name: /CAJA-001/ })).toBeVisible();
    await user.type(screen.getByRole("searchbox"), "CAJA-101");
    const option = await screen.findByRole("option", { name: /CAJA-101/ });
    await user.selectOptions(screen.getByLabelText("Caja"), option);
    expect(screen.getByText("register-101")).toBeVisible();
    expect(fetchMock.mock.calls.some(([input]) => new URL(input instanceof Request ? input.url : input.toString()).searchParams.get("search") === "CAJA-101")).toBe(true);
  });
});
