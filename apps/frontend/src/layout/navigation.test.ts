import { describe, expect, it } from "vitest";
import { testUser } from "../test/fixtures";
import { visibleNavigation } from "./navigation";

describe("permission-aware navigation", () => {
  it("keeps public dashboard and permitted modules", () => {
    const labels = visibleNavigation(testUser).flatMap((group) =>
      group.items.map((item) => item.label),
    );
    expect(labels).toContain("Panel general");
    expect(labels).toContain("Productos");
    expect(labels).toContain("Inventario");
  });

  it("does not advertise modules the current user cannot read", () => {
    const labels = visibleNavigation(testUser).flatMap((group) =>
      group.items.map((item) => item.label),
    );
    expect(labels).not.toContain("Ventas");
    expect(labels).not.toContain("Usuarios");
    expect(labels).not.toContain("Cuentas por cobrar");
    expect(labels).not.toContain("Compras");
    expect(labels).not.toContain("Proveedores");
    expect(labels).not.toContain("Cuentas por pagar");
  });

  it("shows Frontend Phase 10.C purchasing links only with their exact read permissions", () => {
    const purchaser = {
      ...testUser,
      roles: [
        {
          id: "purchasing-role",
          name: "purchasing",
          permissions: [
            "purchases.read",
            "suppliers.read",
            "commercial-payables.read",
          ],
        },
      ],
    };
    const entries = visibleNavigation(purchaser).flatMap((group) =>
      group.items.map((item) => [item.label, item.path]),
    );
    expect(entries).toEqual(
      expect.arrayContaining([
        ["Compras", "/app/purchasing/purchases"],
        ["Proveedores", "/app/purchasing/suppliers"],
        ["Cuentas por pagar", "/app/commercial/payables"],
      ]),
    );
  });

  it("shows administrator modules from the actual backend permission strings", () => {
    const administrator = {
      ...testUser,
      roles: [
        {
          id: "admin-role",
          name: "administrator",
          permissions: [
            "sales.read",
            "products.read",
            "users.read",
            "commercial-summary.read",
          ],
        },
      ],
    };
    const labels = visibleNavigation(administrator).flatMap((group) =>
      group.items.map((item) => item.label),
    );
    expect(labels).toEqual(
      expect.arrayContaining([
        "Panel general",
        "Ventas",
        "Productos",
        "Usuarios",
      ]),
    );
  });
});
