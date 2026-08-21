import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/fixtures";
import { rolesApi, usersApi } from "./admin-api";
import { cashApi } from "./cash-api";

function mockJson(payload: unknown = {}) {
  const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(payload)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
function requestOf(fetchMock: ReturnType<typeof vi.fn>) {
  const [raw, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url: new URL(raw), init };
}
afterEach(() => vi.unstubAllGlobals());

describe("Cash and administration Gateway API contracts", () => {
  it("requests a bounded Cash Session summary without movement payload", async () => {
    const fetchMock = mockJson({ expectedCash: "100.00", movements: [] });
    await cashApi.summary("session-1");
    const { url } = requestOf(fetchMock);
    expect(url.pathname).toBe("/api/cash-sessions/session-1/summary");
    expect(url.searchParams.get("includeMovements")).toBe("false");
  });

  it("passes Cash Movement pagination and supported filters to the server", async () => {
    const fetchMock = mockJson({ data: [], meta: {} });
    await cashApi.movements({
      page: 3,
      limit: 20,
      cashSessionId: "session-1",
      cashRegisterId: "register-1",
      type: "MANUAL_IN",
      reference: "PAY-101",
      createdFrom: "2026-08-01T00:00:00.000-06:00",
    });
    const { url } = requestOf(fetchMock);
    expect(url.pathname).toBe("/api/cash-movements");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      page: "3",
      limit: "20",
      cashSessionId: "session-1",
      cashRegisterId: "register-1",
      type: "MANUAL_IN",
      reference: "PAY-101",
    });
  });

  it("uses explicit Cash lifecycle commands and exact money strings", async () => {
    const fetchMock = mockJson({ id: "session-1" });
    await cashApi.openSession("register-1", {
      openingAmount: "100.25",
      notes: "Inicio",
    });
    expect(requestOf(fetchMock).url.pathname).toBe(
      "/api/cash-registers/register-1/sessions/open",
    );
    expect(requestOf(fetchMock).init.body).toBe(
      JSON.stringify({ openingAmount: "100.25", notes: "Inicio" }),
    );
    fetchMock.mockClear();
    await cashApi.createMovement("session-1", {
      type: "MANUAL_OUT",
      amount: "0.10",
      reason: "Retiro",
    });
    expect(requestOf(fetchMock).url.pathname).toBe(
      "/api/cash-sessions/session-1/movements",
    );
  });

  it("normalizes an empty current-session Gateway response to no OPEN session", async () => {
    mockJson({});
    await expect(cashApi.currentSession("register-1")).resolves.toBeNull();
  });

  it("keeps Users server-paginated and never sends a password on edit", async () => {
    const fetchMock = mockJson({ data: [], meta: {} });
    await usersApi.list({ page: 6, limit: 20, search: "ana" });
    expect(Object.fromEntries(requestOf(fetchMock).url.searchParams)).toEqual({
      page: "6",
      limit: "20",
      search: "ana",
    });
    fetchMock.mockClear();
    await usersApi.update("user-1", {
      email: "ana@example.com",
      firstName: "Ana",
      lastName: "López",
      roleIds: ["role-1"],
    });
    const body = requestOf(fetchMock).init.body;
    expect(typeof body === "string" ? body : "").not.toContain("password");
  });

  it("normalizes Mongo role identifiers without hardcoding role IDs", async () => {
    mockJson([
      {
        _id: "role-1",
        name: "cashier",
        description: "Caja",
        permissions: ["cash-sessions.read"],
        active: true,
      },
    ]);
    await expect(rolesApi.list()).resolves.toEqual([
      expect.objectContaining({ id: "role-1", name: "cashier" }),
    ]);
  });
});
