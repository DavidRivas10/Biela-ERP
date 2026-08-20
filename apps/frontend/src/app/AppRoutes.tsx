import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "../auth/RequireAuth";
import { RequirePermission } from "../auth/RequirePermission";
import { DashboardPage } from "../dashboard/DashboardPage";
import {
  ProductAttributesPage,
  ProductBrandsPage,
  ProductCategoriesPage,
} from "../catalog/CatalogPages";
import {
  ProductDetailPage,
  ProductFormPage,
  ProductsPage,
} from "../catalog/ProductsPages";
import { CompatibilityPage } from "../compatibility/CompatibilityPage";
import {
  InventoryMovementsPage,
  InventoryPage,
  InventoryTransfersPage,
} from "../inventory/InventoryPages";
import { LocationsPage } from "../inventory/LocationsPage";
import { AppShell } from "../layout/AppShell";
import { ForbiddenPage } from "../pages/ForbiddenPage";
import { LoginPage } from "../pages/LoginPage";
import { ModulePlaceholderPage } from "../pages/ModulePlaceholderPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { SearchPage } from "../search/SearchPage";
import {
  VehicleBrandsPage,
  VehicleDetailPage,
  VehicleFormPage,
  VehicleModelsPage,
  VehiclesPage,
} from "../vehicles/VehiclePages";

const modules = [
  ["sales", "Ventas", "sales.read"],
  ["customers", "Clientes", "customers.read"],
  ["purchases", "Compras", "purchases.read"],
  ["suppliers", "Proveedores", "suppliers.read"],
  ["receivables", "Cuentas por cobrar", "commercial-receivables.read"],
  ["payables", "Cuentas por pagar", "commercial-payables.read"],
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
          <Route
            path="catalog/products"
            element={
              <RequirePermission permission="products.read">
                <ProductsPage />
              </RequirePermission>
            }
          />
          <Route
            path="catalog/products/new"
            element={
              <RequirePermission permission="products.create">
                <ProductFormPage />
              </RequirePermission>
            }
          />
          <Route
            path="catalog/products/:id"
            element={
              <RequirePermission permission="products.read">
                <ProductDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="catalog/products/:id/edit"
            element={
              <RequirePermission permission="products.update">
                <ProductFormPage />
              </RequirePermission>
            }
          />
          <Route
            path="catalog/categories"
            element={
              <RequirePermission permission="products.read">
                <ProductCategoriesPage />
              </RequirePermission>
            }
          />
          <Route
            path="catalog/brands"
            element={
              <RequirePermission permission="products.read">
                <ProductBrandsPage />
              </RequirePermission>
            }
          />
          <Route
            path="catalog/attributes"
            element={
              <RequirePermission permission="products.read">
                <ProductAttributesPage />
              </RequirePermission>
            }
          />
          <Route
            path="vehicles"
            element={
              <RequirePermission permission="vehicles.read">
                <VehiclesPage />
              </RequirePermission>
            }
          />
          <Route
            path="vehicles/new"
            element={
              <RequirePermission permission="vehicles.create">
                <VehicleFormPage />
              </RequirePermission>
            }
          />
          <Route
            path="vehicles/:id"
            element={
              <RequirePermission permission="vehicles.read">
                <VehicleDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="vehicles/:id/edit"
            element={
              <RequirePermission permission="vehicles.update">
                <VehicleFormPage />
              </RequirePermission>
            }
          />
          <Route
            path="vehicles/brands"
            element={
              <RequirePermission permission="vehicles.read">
                <VehicleBrandsPage />
              </RequirePermission>
            }
          />
          <Route
            path="vehicles/models"
            element={
              <RequirePermission permission="vehicles.read">
                <VehicleModelsPage />
              </RequirePermission>
            }
          />
          <Route
            path="compatibility"
            element={
              <RequirePermission permission="compatibilities.read">
                <CompatibilityPage />
              </RequirePermission>
            }
          />
          <Route
            path="inventory"
            element={
              <RequirePermission permission="inventory.read">
                <InventoryPage />
              </RequirePermission>
            }
          />
          <Route
            path="inventory/locations"
            element={
              <RequirePermission permission="locations.read">
                <LocationsPage />
              </RequirePermission>
            }
          />
          <Route
            path="inventory/movements"
            element={
              <RequirePermission permission="inventory.read">
                <InventoryMovementsPage />
              </RequirePermission>
            }
          />
          <Route
            path="inventory/transfers"
            element={
              <RequirePermission permission="inventory.transfer">
                <InventoryTransfersPage />
              </RequirePermission>
            }
          />
          <Route
            path="search"
            element={
              <RequirePermission permission="search.read">
                <SearchPage />
              </RequirePermission>
            }
          />
          <Route
            path="products/*"
            element={<Navigate to="/app/catalog/products" replace />}
          />
          <Route
            path="locations/*"
            element={<Navigate to="/app/inventory/locations" replace />}
          />
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
