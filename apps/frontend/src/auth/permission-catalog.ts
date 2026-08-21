export const PERMISSION_CATALOG = [
  "users.read", "users.create", "users.update", "users.activate", "users.deactivate",
  "roles.read", "roles.manage",
  "products.read", "products.create", "products.update",
  "vehicles.read", "vehicles.create", "vehicles.update",
  "compatibilities.read", "compatibilities.manage",
  "locations.read", "locations.create", "locations.update",
  "inventory.read", "inventory.adjust", "inventory.transfer", "search.read",
  "suppliers.read", "suppliers.create", "suppliers.update",
  "purchases.read", "purchases.create", "purchases.update", "purchases.receive", "purchases.return", "purchases.pay",
  "customers.read", "customers.create", "customers.update",
  "sales.read", "sales.create", "sales.update", "sales.post", "sales.return",
  "payment-methods.read", "payment-methods.manage",
  "cash-registers.read", "cash-registers.manage",
  "cash-sessions.read", "cash-sessions.open", "cash-sessions.close",
  "payments.read", "payments.create", "payments.reverse",
  "cash-movements.read", "cash-movements.create",
  "commercial-receivables.read", "commercial-payables.read", "commercial-summary.read",
] as const;

export function permissionsByDomain(permissions: readonly string[]) {
  return permissions.reduce<Record<string, string[]>>((groups, permission) => {
    const domain = permission.split(".")[0];
    (groups[domain] ??= []).push(permission);
    return groups;
  }, {});
}
