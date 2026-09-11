import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/fixtures";
import { ProductFormPage } from "./ProductsPages";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: () => true }),
}));

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        jsonResponse({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } }),
      ),
    ),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("ProductFormPage — arriving from an unrecognized scan", () => {
  it("prefills the code from ?code= so it isn't typed twice", () => {
    stubFetch();
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter
          initialEntries={["/app/catalog/products/new?code=NEW-999"]}
        >
          <Routes>
            <Route
              path="/app/catalog/products/new"
              element={<ProductFormPage />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByLabelText(/^Código/)).toHaveValue("NEW-999");
  });
});
