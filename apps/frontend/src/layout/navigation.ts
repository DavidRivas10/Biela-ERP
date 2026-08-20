import type { CurrentUser } from "../types/api";
import { hasPermission } from "../auth/permissions";

export interface NavigationItem {
  label: string;
  path: string;
  short: string;
  permission?: string;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export const NAVIGATION: NavigationGroup[] = [
  {
    label: "Inicio",
    items: [{ label: "Panel general", path: "/app/dashboard", short: "PG" }],
  },
  {
    label: "Comercial",
    items: [
      {
        label: "Ventas",
        path: "/app/sales",
        short: "VE",
        permission: "sales.read",
      },
      {
        label: "Clientes",
        path: "/app/customers",
        short: "CL",
        permission: "customers.read",
      },
      {
        label: "Compras",
        path: "/app/purchases",
        short: "CO",
        permission: "purchases.read",
      },
      {
        label: "Proveedores",
        path: "/app/suppliers",
        short: "PR",
        permission: "suppliers.read",
      },
      {
        label: "Cuentas por cobrar",
        path: "/app/receivables",
        short: "CC",
        permission: "commercial-receivables.read",
      },
      {
        label: "Cuentas por pagar",
        path: "/app/payables",
        short: "CP",
        permission: "commercial-payables.read",
      },
    ],
  },
  {
    label: "Operación",
    items: [
      {
        label: "Inventario",
        path: "/app/inventory",
        short: "IN",
        permission: "inventory.read",
      },
      {
        label: "Productos",
        path: "/app/products",
        short: "PT",
        permission: "products.read",
      },
      {
        label: "Vehículos",
        path: "/app/vehicles",
        short: "VH",
        permission: "vehicles.read",
      },
      {
        label: "Ubicaciones",
        path: "/app/locations",
        short: "UB",
        permission: "locations.read",
      },
      {
        label: "Caja",
        path: "/app/cash",
        short: "CJ",
        permission: "cash-sessions.read",
      },
    ],
  },
  {
    label: "Administración",
    items: [
      {
        label: "Usuarios",
        path: "/app/users",
        short: "US",
        permission: "users.read",
      },
      {
        label: "Roles",
        path: "/app/roles",
        short: "RO",
        permission: "roles.read",
      },
    ],
  },
];

export function visibleNavigation(user: CurrentUser | null): NavigationGroup[] {
  return NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.permission || hasPermission(user, item.permission),
    ),
  })).filter((group) => group.items.length > 0);
}
