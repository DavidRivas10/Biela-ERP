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
        path: "/app/sales/customers",
        short: "CL",
        permission: "customers.read",
      },
      {
        label: "Compras",
        path: "/app/purchasing/purchases",
        short: "CO",
        permission: "purchases.read",
      },
      {
        label: "Proveedores",
        path: "/app/purchasing/suppliers",
        short: "PR",
        permission: "suppliers.read",
      },
      {
        label: "Cuentas por cobrar",
        path: "/app/commercial/receivables",
        short: "CC",
        permission: "commercial-receivables.read",
      },
      {
        label: "Cuentas por pagar",
        path: "/app/commercial/payables",
        short: "CP",
        permission: "commercial-payables.read",
      },
    ],
  },
  {
    label: "Catálogo",
    items: [
      {
        label: "Productos",
        path: "/app/catalog/products",
        short: "PT",
        permission: "products.read",
      },
      {
        label: "Categorías",
        path: "/app/catalog/categories",
        short: "CA",
        permission: "products.read",
      },
      {
        label: "Marcas",
        path: "/app/catalog/brands",
        short: "MA",
        permission: "products.read",
      },
      {
        label: "Atributos",
        path: "/app/catalog/attributes",
        short: "AT",
        permission: "products.read",
      },
    ],
  },
  {
    label: "Vehículos",
    items: [
      {
        label: "Vehículos",
        path: "/app/vehicles",
        short: "VH",
        permission: "vehicles.read",
      },
      {
        label: "Marcas",
        path: "/app/vehicles/brands",
        short: "MV",
        permission: "vehicles.read",
      },
      {
        label: "Modelos",
        path: "/app/vehicles/models",
        short: "MO",
        permission: "vehicles.read",
      },
      {
        label: "Compatibilidad",
        path: "/app/compatibility",
        short: "CP",
        permission: "compatibilities.read",
      },
    ],
  },
  {
    label: "Almacén",
    items: [
      {
        label: "Inventario",
        path: "/app/inventory",
        short: "IN",
        permission: "inventory.read",
      },
      {
        label: "Ubicaciones",
        path: "/app/inventory/locations",
        short: "UB",
        permission: "locations.read",
      },
    ],
  },
  {
    label: "Caja",
    items: [
      {
        label: "Cajas",
        path: "/app/cash/registers",
        short: "CJ",
        permission: "cash-registers.read",
      },
      {
        label: "Sesiones",
        path: "/app/cash/sessions",
        short: "SE",
        permission: "cash-sessions.read",
      },
    ],
  },
  {
    label: "Administración",
    items: [
      {
        label: "Usuarios",
        path: "/app/admin/users",
        short: "US",
        permission: "users.read",
      },
      {
        label: "Roles",
        path: "/app/admin/roles",
        short: "RO",
        permission: "roles.read",
      },
    ],
  },
];

/**
 * Titles for routes that are reachable but not their own sidebar entry
 * (they live as tabs inside another screen). Longest matching prefix wins.
 */
export const AUXILIARY_ROUTE_TITLES: Array<{ path: string; label: string }> = [
  { path: "/app/inventory/movements", label: "Movimientos de inventario" },
  { path: "/app/inventory/transfers", label: "Transferencias de inventario" },
  { path: "/app/search", label: "Buscar repuesto" },
  { path: "/app/cash/movements", label: "Movimientos de efectivo" },
];

export function visibleNavigation(user: CurrentUser | null): NavigationGroup[] {
  return NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.permission || hasPermission(user, item.permission),
    ),
  })).filter((group) => group.items.length > 0);
}
