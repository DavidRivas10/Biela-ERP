import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/fixtures";
import { CustomerSelector } from "./SalesSelectors";

afterEach(() => vi.unstubAllGlobals());

describe("Frontend Phase 10.D Customer selector", () => {
  it("discovers and selects a Customer outside the initial result page through server search", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      const searched = url.searchParams.get("search") === "CLI-101";
      return Promise.resolve(jsonResponse({
        data: searched ? [{ id: "customer-101", code: "CLI-101", name: "Cliente remoto", active: true }] : [{ id: "customer-1", code: "CLI-001", name: "Cliente inicial", active: true }],
        meta: { page: 1, limit: 20, total: searched ? 1 : 101, pages: searched ? 1 : 6 },
      }));
    });
    vi.stubGlobal("fetch", fetchMock);
    function Harness() {
      const [value, setValue] = useState("");
      return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CustomerSelector id="customer" label="Cliente" value={value} onChange={setValue} /><output>{value}</output></QueryClientProvider>;
    }
    const user = userEvent.setup();
    render(<Harness />);
    expect(await screen.findByRole("option", { name: /CLI-001/ })).toBeVisible();
    await user.type(screen.getByRole("searchbox"), "CLI-101");
    const target = await screen.findByRole("option", { name: /CLI-101/ });
    await user.selectOptions(screen.getByLabelText("Cliente"), target);
    expect(screen.getByText("customer-101")).toBeVisible();
    expect(fetchMock.mock.calls.some(([input]) => new URL(input instanceof Request ? input.url : input.toString()).searchParams.get("search") === "CLI-101")).toBe(true);
  });
});
