import type { CurrentUser } from "../types/api";
import { hasAnyPermission, hasPermission } from "../auth/permissions";

export interface NavigationItem {
  label: string;
  path: string;
  short: string;
  /** Visible when the user holds this permission. */
  permission?: string;
  /** Visible when the user holds at least one of these permissions. */
  anyPermission?: readonly string[];
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

/** Permissions behind every screen grouped under "Mantenimientos". */
export const MAINTENANCE_PERMISSIONS = [
  "products.read",
  "vehicles.read",
  "locations.read",
] as const;

export const NAVIGATION: NavigationGroup[] = [
  {
    label: "Inicio",
    items: [{ label: "Panel general", path: "/app/dashboard", short: "IN" }],
  },
  {
    label: "Vender",
    items: [
      {
        label: "Punto de venta",
        path: "/app/pos",
        short: "PV",
        anyPermission: ["sales.create", "cash-sessions.open", "payments.create"],
      },
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
    ],
  },
  {
    label: "Comprar",
    items: [
      {
        label: "Recepción de facturas",
        path: "/app/purchasing/inbox",
        short: "RF",
        anyPermission: ["purchases.receive", "purchases.pay"],
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
    ],
  },
  {
    label: "Dinero",
    items: [
      {
        label: "Resumen",
        path: "/app/commercial/money-summary",
        short: "RS",
        permission: "commercial-summary.read",
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
      {
        label: "Cajas",
        path: "/app/cash/registers",
        short: "CJ",
        permission: "cash-registers.read",
      },
      {
        label: "Sesiones de caja",
        path: "/app/cash/sessions",
        short: "SC",
        permission: "cash-sessions.read",
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
        label: "Vehículos",
        path: "/app/vehicles",
        short: "VH",
        permission: "vehicles.read",
      },
      {
        label: "Compatibilidad",
        path: "/app/compatibility",
        short: "CB",
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
        short: "IV",
        permission: "inventory.read",
      },
    ],
  },
  {
    label: "Mantenimientos",
    items: [
      {
        label: "Mantenimientos",
        path: "/app/mantenimientos",
        short: "MN",
        anyPermission: MAINTENANCE_PERMISSIONS,
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
 * (tabs inside another screen, or the maintenance catalogs that live under the
 * Mantenimientos hub). Longest matching prefix wins.
 */
export const AUXILIARY_ROUTE_TITLES: Array<{ path: string; label: string }> = [
  { path: "/app/inventory/movements", label: "Movimientos de inventario" },
  { path: "/app/inventory/transfers", label: "Transferencias de inventario" },
  { path: "/app/search", label: "Buscar repuesto" },
  { path: "/app/cash/movements", label: "Movimientos de efectivo" },
  { path: "/app/mantenimientos/categorias", label: "Categorías de producto" },
  {
    path: "/app/mantenimientos/marcas-producto",
    label: "Marcas de producto",
  },
  { path: "/app/mantenimientos/atributos", label: "Atributos de producto" },
  { path: "/app/mantenimientos/marcas-vehiculo", label: "Marcas de vehículo" },
  { path: "/app/mantenimientos/modelos", label: "Modelos de vehículo" },
  { path: "/app/mantenimientos/ubicaciones", label: "Ubicaciones" },
];

function itemVisible(user: CurrentUser | null, item: NavigationItem): boolean {
  if (item.permission && !hasPermission(user, item.permission)) return false;
  if (item.anyPermission && !hasAnyPermission(user, item.anyPermission)) {
    return false;
  }
  return true;
}

export function visibleNavigation(user: CurrentUser | null): NavigationGroup[] {
  return NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => itemVisible(user, item)),
  })).filter((group) => group.items.length > 0);
}
