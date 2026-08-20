import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_KEY } from "../auth/token-storage";
import { jsonResponse } from "../test/fixtures";
import {
  ApiNetworkError,
  apiRequest,
  getApiBaseUrl,
  subscribeUnauthorized,
} from "./api-client";

afterEach(() => vi.unstubAllGlobals());

describe("apiRequest", () => {
  it("uses the centralized Gateway base URL and injects the bearer token", async () => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, "session-token");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest<{ ok: boolean }>("/api/example")).resolves.toEqual({
      ok: true,
    });
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${getApiBaseUrl()}/api/example`);
    expect(new Headers(request.headers).get("Authorization")).toBe(
      "Bearer session-token",
    );
  });

  it("does not send a token for public requests", async () => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, "secret");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/system/health", { authenticated: false });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).has("Authorization")).toBe(false);
  });

  it("rejects an absolute URL outside the configured Gateway", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiRequest("https://example.com/api/data")).rejects.toThrow(
      "rutas del API Gateway",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serializes JSON bodies and typed query parameters", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ created: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/example", {
      method: "POST",
      body: { name: "Filtro" },
      query: {
        page: 2,
        active: true,
        tag: ["a", "b"],
        omitted: undefined,
      },
    });

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.searchParams.get("page")).toBe("2");
    expect(parsed.searchParams.get("active")).toBe("true");
    expect(parsed.searchParams.getAll("tag")).toEqual(["a", "b"]);
    expect(parsed.searchParams.has("omitted")).toBe(false);
    expect(request.body).toBe(JSON.stringify({ name: "Filtro" }));
    expect(new Headers(request.headers).get("Content-Type")).toBe(
      "application/json",
    );
  });

  it("returns undefined for an empty successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    await expect(
      apiRequest<void>("/api/example", { method: "DELETE" }),
    ).resolves.toBeUndefined();
  });

  it("notifies the auth lifecycle on an authenticated 401", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeUnauthorized(listener);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ message: "Unauthorized" }, 401)),
    );

    await expect(apiRequest("/api/products")).rejects.toMatchObject({
      status: 401,
    });
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("keeps 403 distinct and does not notify the logout lifecycle", async () => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, "still-valid");
    const listener = vi.fn();
    const unsubscribe = subscribeUnauthorized(listener);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ message: "Forbidden" }, 403)),
    );

    await expect(apiRequest("/api/restricted")).rejects.toMatchObject({
      status: 403,
    });
    expect(listener).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBe("still-valid");
    unsubscribe();
  });

  it("preserves normalized Gateway errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ message: "Upstream unavailable" }, 502),
        ),
    );
    await expect(apiRequest("/api/products")).rejects.toEqual(
      expect.objectContaining({ status: 502, message: "Upstream unavailable" }),
    );
  });

  it.each([403, 409, 503])(
    "preserves HTTP %i without treating it as a transport failure",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            jsonResponse({ message: `HTTP ${status}` }, status),
          ),
      );
      await expect(apiRequest("/api/example")).rejects.toEqual(
        expect.objectContaining({ status, message: `HTTP ${status}` }),
      );
    },
  );

  it("distinguishes transport failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(apiRequest("/api/products")).rejects.toBeInstanceOf(
      ApiNetworkError,
    );
  });
});
