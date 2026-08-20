import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "../auth/RequireAuth";
import { RequirePermission } from "../auth/RequirePermission";
import { DashboardPage } from "../dashboard/DashboardPage";
import { AppShell } from "../layout/AppShell";
import { ForbiddenPage } from "../pages/ForbiddenPage";
import { LoginPage } from "../pages/LoginPage";
import { ModulePlaceholderPage } from "../pages/ModulePlaceholderPage";
import { NotFoundPage } from "../pages/NotFoundPage";

const modules = [
  ["sales", "Ventas", "sales.read"],
  ["customers", "Clientes", "customers.read"],
  ["purchases", "Compras", "purchases.read"],
  ["suppliers", "Proveedores", "suppliers.read"],
  ["receivables", "Cuentas por cobrar", "commercial-receivables.read"],
  ["payables", "Cuentas por pagar", "commercial-payables.read"],
  ["inventory", "Inventario", "inventory.read"],
  ["products", "Productos", "products.read"],
  ["vehicles", "Vehículos", "vehicles.read"],
  ["locations", "Ubicaciones", "locations.read"],
  ["cash", "Caja", "cash-sessions.read"],
  ["users", "Usuarios", "users.read"],
  ["roles", "Roles", "roles.read"],
] as const;

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          {modules.map(([path, title, permission]) => (
            <Route
              key={path}
              path={path}
              element={
                <RequirePermission permission={permission}>
                  <ModulePlaceholderPage title={title} />
                </RequirePermission>
              }
            />
          ))}
        </Route>
        <Route path="/forbidden" element={<ForbiddenPage />} />
      </Route>
      <Route path="/not-found" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/not-found" replace />} />
    </Routes>
  );
}
