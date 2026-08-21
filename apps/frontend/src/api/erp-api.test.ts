import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/fixtures";
import { catalogApi } from "./catalog-api";
import { compatibilityApi } from "./compatibility-api";
import { inventoryApi } from "./inventory-api";
import { searchApi } from "./search-api";
import { vehiclesApi } from "./vehicles-api";

function mockJson(payload: unknown = {}) {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestOf(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url: new URL(url), init };
}

function jsonBody(init: RequestInit): Record<string, unknown> {
  if (typeof init.body !== "string")
    throw new Error("Expected a JSON string body");
  return JSON.parse(init.body) as Record<string, unknown>;
}

afterEach(() => vi.unstubAllGlobals());

describe("Frontend Phase 10.B typed API modules", () => {
  it("uses the Gateway product contract and preserves decimal strings", async () => {
    const fetchMock = mockJson({ id: "product-1" });
    await catalogApi.createProduct({
      code: "BP-1",
      name: "Pastilla",
      categoryId: "category-1",
      brandId: "brand-1",
      defaultSalePrice: "125.5000",
    });
    const request = requestOf(fetchMock);
    expect(request.url.pathname).toBe("/api/products");
    expect(request.init.method).toBe("POST");
    expect(jsonBody(request.init)).toMatchObject({
      defaultSalePrice: "125.5000",
    });
  });

  it("sends vehicle filters to the paginated Gateway endpoint", async () => {
    const fetchMock = mockJson({ data: [], meta: {} });
    await vehiclesApi.vehicles({
      page: 3,
      brandId: "brand-1",
      year: 2015,
      active: true,
    });
    const request = requestOf(fetchMock);
    expect(request.url.pathname).toBe("/api/vehicles");
    expect(request.url.searchParams.get("page")).toBe("3");
    expect(request.url.searchParams.get("year")).toBe("2015");
  });

  it("creates explicit compatibility and exposes lifecycle updates without DELETE", async () => {
    const fetchMock = mockJson({ id: "compatibility-1" });
    await compatibilityApi.update("compatibility-1", { active: false });
    const request = requestOf(fetchMock);
    expect(request.url.pathname).toBe("/api/compatibilities/compatibility-1");
    expect(request.init.method).toBe("PATCH");
    expect(jsonBody(request.init)).toEqual({ active: false });
  });

  it.each([
    ["INITIAL", undefined, "location-b"],
    ["IN", undefined, "location-b"],
    ["OUT", "location-a", undefined],
    ["ADJUSTMENT", undefined, "location-b"],
    ["TRANSFER", "location-a", "location-b"],
  ] as const)(
    "posts %s through the public inventory movement endpoint",
    async (type, sourceLocationId, destinationLocationId) => {
      const fetchMock = mockJson({ id: "movement-1", type });
      await inventoryApi.createMovement({
        type,
        productId: "product-1",
        quantity: type === "ADJUSTMENT" ? 0 : 2,
        sourceLocationId,
        destinationLocationId,
        reason: type === "ADJUSTMENT" ? "Conteo" : undefined,
      });
      const request = requestOf(fetchMock);
      expect(request.url.pathname).toBe("/api/inventory/movements");
      expect(request.init.method).toBe("POST");
      expect(jsonBody(request.init)).toMatchObject({
        type,
        productId: "product-1",
      });
    },
  );

  it("passes deterministic search filters without client-side ranking parameters", async () => {
    const fetchMock = mockJson({ data: [], meta: {} });
    await searchApi.products({
      q: "BP-1",
      inStock: true,
      vehicleModelId: "model-1",
      page: 2,
    });
    const request = requestOf(fetchMock);
    expect(request.url.pathname).toBe("/api/search/products");
    expect(Object.fromEntries(request.url.searchParams)).toEqual({
      q: "BP-1",
      inStock: "true",
      vehicleModelId: "model-1",
      page: "2",
    });
  });
});
