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

/**
 * Business-readable Spanish names for the technical permission domains.
 * The keys match the first segment produced by `permissionsByDomain`.
 * These labels are UX only; the codes sent to the backend never change.
 */
export const DOMAIN_LABELS: Record<string, string> = {
  users: "Usuarios",
  roles: "Roles",
  products: "Productos",
  vehicles: "Vehículos",
  compatibilities: "Compatibilidad",
  locations: "Ubicaciones",
  inventory: "Inventario",
  search: "Búsqueda",
  suppliers: "Proveedores",
  purchases: "Compras",
  customers: "Clientes",
  sales: "Ventas",
  "payment-methods": "Formas de pago",
  "cash-registers": "Cajas",
  "cash-sessions": "Sesiones de caja",
  payments: "Pagos y reembolsos",
  "cash-movements": "Movimientos de caja",
  "commercial-receivables": "Cuentas por cobrar",
  "commercial-payables": "Cuentas por pagar",
  "commercial-summary": "Resumen comercial",
};

export function domainLabel(domain: string): string {
  return DOMAIN_LABELS[domain] ?? domain;
}

interface PermissionCopy {
  /** Short action name in Spanish, e.g. "Crear productos". */
  label: string;
  /** One-line plain-language explanation for a non-technical administrator. */
  description: string;
}

/**
 * Spanish label + short description for every permission code in
 * `PERMISSION_CATALOG`. Shown next to the technical code in the Roles and
 * Users screens so a business owner can build a role without reading code.
 * The permission strings themselves are unchanged and remain authoritative.
 */
export const PERMISSION_LABELS: Record<string, PermissionCopy> = {
  "users.read": { label: "Ver usuarios", description: "Consultar la lista y el detalle de los usuarios." },
  "users.create": { label: "Crear usuarios", description: "Registrar usuarios nuevos con su contraseña inicial." },
  "users.update": { label: "Editar usuarios", description: "Cambiar los datos y los roles de un usuario." },
  "users.activate": { label: "Activar usuarios", description: "Volver a dar acceso a un usuario dado de baja." },
  "users.deactivate": { label: "Desactivar usuarios", description: "Quitar el acceso a un usuario sin borrar su historial." },

  "roles.read": { label: "Ver roles", description: "Consultar los roles y los permisos de cada uno." },
  "roles.manage": { label: "Administrar roles", description: "Crear y editar roles y los permisos que incluyen." },

  "products.read": { label: "Ver productos", description: "Consultar el catálogo de productos." },
  "products.create": { label: "Crear productos", description: "Agregar productos nuevos al catálogo." },
  "products.update": { label: "Editar productos", description: "Modificar los datos de un producto existente." },

  "vehicles.read": { label: "Ver vehículos", description: "Consultar el catálogo de vehículos." },
  "vehicles.create": { label: "Crear vehículos", description: "Agregar vehículos nuevos (marca, modelo, año, motor)." },
  "vehicles.update": { label: "Editar vehículos", description: "Modificar los datos de un vehículo existente." },

  "compatibilities.read": { label: "Ver compatibilidad", description: "Consultar qué productos aplican a cada vehículo." },
  "compatibilities.manage": { label: "Administrar compatibilidad", description: "Vincular y desvincular productos con vehículos." },

  "locations.read": { label: "Ver ubicaciones", description: "Consultar las ubicaciones del almacén." },
  "locations.create": { label: "Crear ubicaciones", description: "Agregar pasillos, estantes u otras ubicaciones." },
  "locations.update": { label: "Editar ubicaciones", description: "Modificar o dar de baja una ubicación." },

  "inventory.read": { label: "Ver inventario", description: "Consultar existencias, movimientos e historial de stock." },
  "inventory.adjust": { label: "Ajustar inventario", description: "Registrar entradas, salidas y ajustes de existencias." },
  "inventory.transfer": { label: "Transferir inventario", description: "Mover existencias de una ubicación a otra." },
  "search.read": { label: "Usar la búsqueda", description: "Buscar productos por código, nombre o vehículo compatible." },

  "suppliers.read": { label: "Ver proveedores", description: "Consultar la lista y el detalle de proveedores." },
  "suppliers.create": { label: "Crear proveedores", description: "Registrar proveedores nuevos." },
  "suppliers.update": { label: "Editar proveedores", description: "Modificar los datos de un proveedor." },

  "purchases.read": { label: "Ver compras", description: "Consultar las órdenes de compra a proveedores." },
  "purchases.create": { label: "Crear compras", description: "Registrar órdenes de compra nuevas." },
  "purchases.update": { label: "Editar compras", description: "Modificar una compra que todavía está en borrador." },
  "purchases.receive": { label: "Recibir compras", description: "Registrar la entrada de mercadería de una compra al inventario." },
  "purchases.return": { label: "Devolver a proveedor", description: "Registrar devoluciones de mercadería al proveedor." },
  "purchases.pay": { label: "Pagar compras", description: "Registrar pagos y reembolsos de compras a proveedores." },

  "customers.read": { label: "Ver clientes", description: "Consultar la lista y el detalle de clientes registrados." },
  "customers.create": { label: "Crear clientes", description: "Registrar clientes nuevos (no obliga a hacerlo en cada venta)." },
  "customers.update": { label: "Editar clientes", description: "Modificar los datos de un cliente." },

  "sales.read": { label: "Ver ventas", description: "Consultar las ventas y su detalle." },
  "sales.create": { label: "Crear ventas", description: "Iniciar una venta de mostrador o una cuenta abierta." },
  "sales.update": { label: "Editar ventas", description: "Modificar una venta antes de confirmarla." },
  "sales.post": { label: "Confirmar ventas", description: "Confirmar la venta y descontar el inventario." },
  "sales.return": { label: "Devoluciones de venta", description: "Registrar devoluciones de clientes y su reingreso al inventario." },

  "payment-methods.read": { label: "Ver formas de pago", description: "Consultar las formas de pago configuradas." },
  "payment-methods.manage": { label: "Administrar formas de pago", description: "Crear y editar formas de pago (efectivo, tarjeta, transferencia)." },

  "cash-registers.read": { label: "Ver cajas", description: "Consultar las cajas registradoras." },
  "cash-registers.manage": { label: "Administrar cajas", description: "Crear y editar cajas registradoras." },

  "cash-sessions.read": { label: "Ver sesiones de caja", description: "Consultar aperturas, cierres y arqueos de caja." },
  "cash-sessions.open": { label: "Abrir caja", description: "Abrir una sesión de caja con su monto inicial." },
  "cash-sessions.close": { label: "Cerrar caja", description: "Cerrar la sesión de caja con el conteo de efectivo." },

  "payments.read": { label: "Ver pagos", description: "Consultar los pagos y reembolsos registrados." },
  "payments.create": { label: "Registrar pagos", description: "Registrar cobros a clientes y reembolsos." },
  "payments.reverse": { label: "Reversar pagos", description: "Anular un pago o reembolso ya registrado dejando rastro." },

  "cash-movements.read": { label: "Ver movimientos de caja", description: "Consultar el detalle de entradas y salidas de efectivo." },
  "cash-movements.create": { label: "Registrar movimientos de caja", description: "Registrar entradas y salidas manuales de efectivo." },

  "commercial-receivables.read": { label: "Ver cuentas por cobrar", description: "Consultar lo que los clientes deben por ventas a crédito." },
  "commercial-payables.read": { label: "Ver cuentas por pagar", description: "Consultar lo que se debe a proveedores por compras a crédito." },
  "commercial-summary.read": { label: "Ver resumen comercial", description: "Ver el resumen operativo del panel principal." },
};

export function permissionLabel(permission: string): string {
  return PERMISSION_LABELS[permission]?.label ?? permission;
}

export function permissionDescription(permission: string): string | undefined {
  return PERMISSION_LABELS[permission]?.description;
}
