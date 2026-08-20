import { describe, expect, it } from "vitest";
import { testUser } from "../test/fixtures";
import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  permissionsOf,
} from "./permissions";

describe("permission helpers", () => {
  it("flattens and deduplicates permissions across roles", () => {
    const user = {
      ...testUser,
      roles: [
        testUser.roles[0],
        {
          id: "role-2",
          name: "catalog",
          permissions: ["products.read", "vehicles.read"],
        },
      ],
    };
    expect([...permissionsOf(user)].sort()).toEqual([
      "inventory.read",
      "products.read",
      "vehicles.read",
    ]);
  });

  it("denies missing permissions and anonymous users", () => {
    expect(hasPermission(testUser, "products.read")).toBe(true);
    expect(hasPermission(testUser, "sales.read")).toBe(false);
    expect(hasPermission(null, "products.read")).toBe(false);
  });

  it("supports any/all permission checks across roles", () => {
    expect(hasAnyPermission(testUser, ["sales.read", "inventory.read"])).toBe(
      true,
    );
    expect(hasAnyPermission(testUser, ["sales.read", "users.read"])).toBe(
      false,
    );
    expect(
      hasAllPermissions(testUser, ["products.read", "inventory.read"]),
    ).toBe(true);
    expect(hasAllPermissions(testUser, ["products.read", "sales.read"])).toBe(
      false,
    );
  });
});
