import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  invalidateCashIntegration,
  invalidateCommercialSummary,
  invalidateCustomerReferenceIntegration,
  invalidateInventoryIntegration,
  invalidateLocationReferenceIntegration,
  invalidateProductReferenceIntegration,
  invalidateSupplierReferenceIntegration,
  invalidateUserRoleIntegration,
  invalidateVehicleReferenceIntegration,
} from "./invalidation";

function clientSpy() {
  return {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  } as unknown as QueryClient;
}

describe("cross-module query invalidation", () => {
  it("invalidates Product references across Catalog, fitment, stock and Search", async () => {
    const client = clientSpy();
    await invalidateProductReferenceIntegration(client);
    for (const queryKey of [
      ["catalog", "products"],
      ["catalog", "product"],
      ["compatibilities"],
      ["inventory"],
      ["search", "products"],
    ])
      expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey });
  });

  it("invalidates Vehicle references across hierarchy, fitment and Search", async () => {
    const client = clientSpy();
    await invalidateVehicleReferenceIntegration(client);
    for (const queryKey of [
      ["vehicles", "list"],
      ["vehicles", "detail"],
      ["compatibilities"],
      ["search", "products"],
    ])
      expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey });
  });

  it("invalidates Location references in Inventory and commercial documents", async () => {
    const client = clientSpy();
    await invalidateLocationReferenceIntegration(client);
    for (const queryKey of [
      ["inventory"],
      ["purchasing", "purchase"],
      ["sales", "document"],
    ])
      expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey });
  });

  it("invalidates Supplier references in purchasing and Payables", async () => {
    const client = clientSpy();
    await invalidateSupplierReferenceIntegration(client);
    for (const queryKey of [
      ["purchasing", "suppliers"],
      ["purchasing", "supplier"],
      ["purchasing", "purchases"],
      ["purchasing", "purchase"],
      ["commercial", "payables"],
      ["commercial", "supplier-account"],
    ])
      expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey });
  });

  it("invalidates Customer references in sales and Receivables", async () => {
    const client = clientSpy();
    await invalidateCustomerReferenceIntegration(client);
    for (const queryKey of [
      ["sales", "customers"],
      ["sales", "customer"],
      ["sales", "documents"],
      ["sales", "document"],
      ["commercial", "receivables"],
      ["commercial", "customer-account"],
    ])
      expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey });
  });

  it("invalidates every Inventory view and deterministic Search", async () => {
    const client = clientSpy();
    await invalidateInventoryIntegration(client);
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["inventory"],
    });
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["search", "products"],
    });
  });

  it("invalidates Cash detail, ledger and Dashboard summary", async () => {
    const client = clientSpy();
    await invalidateCashIntegration(client);
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["finance", "sessions"],
    });
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["finance", "session"],
    });
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["finance", "cash-movements"],
    });
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["commercial-summary"],
    });
  });

  it("uses the Dashboard's actual commercial summary key", async () => {
    const client = clientSpy();
    await invalidateCommercialSummary(client);
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["commercial-summary"],
    });
  });

  it("invalidates users that embed changed Role permissions", async () => {
    const client = clientSpy();
    await invalidateUserRoleIntegration(client);
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["administration", "users"],
    });
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["administration", "user"],
    });
  });
});
