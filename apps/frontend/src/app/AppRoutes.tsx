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
import { NotFoundPage } from "../pages/NotFoundPage";
import { SearchPage } from "../search/SearchPage";
import {
  CustomerDetailPage,
  CustomerFormPage,
  CustomersPage,
} from "../sales/CustomerPages";
import { ReceivablesPage } from "../sales/ReceivablesPage";
import {
  SaleReturnCreatePage,
  SaleReturnDetailPage,
} from "../sales/SaleReturnPages";
import {
  SalePaymentsPage,
  SaleRefundsPage,
} from "../sales/SalesFinancePages";
import {
  SaleDetailPage,
  SaleFormPage,
  SalesPage,
} from "../sales/SalesPages";
import { PayablesPage } from "../purchasing/PayablesPage";
import {
  PurchaseDetailPage,
  PurchaseFormPage,
  PurchasesPage,
} from "../purchasing/PurchasePages";
import {
  PurchasePaymentsPage,
  PurchaseReturnDetailPage,
} from "../purchasing/PurchaseFinancePages";
import {
  PurchaseReceiptCreatePage,
  PurchaseReceiptDetailPage,
  PurchaseReturnCreatePage,
} from "../purchasing/ReceiptReturnPages";
import {
  SupplierDetailPage,
  SupplierFormPage,
  SuppliersPage,
} from "../purchasing/SupplierPages";
import {
  VehicleBrandsPage,
  VehicleDetailPage,
  VehicleFormPage,
  VehicleModelsPage,
  VehiclesPage,
} from "../vehicles/VehiclePages";
import {
  CashMovementsPage,
  CashRegisterDetailPage,
  CashRegisterFormPage,
  CashRegistersPage,
  CashSessionDetailPage,
  CashSessionsPage,
} from "../cash/CashPages";
import {
  RoleDetailPage,
  RoleFormPage,
  RolesPage,
  UserDetailPage,
  UserFormPage,
  UsersPage,
} from "../admin/AdminPages";

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
            path="purchasing/suppliers"
            element={
              <RequirePermission permission="suppliers.read">
                <SuppliersPage />
              </RequirePermission>
            }
          />
          <Route
            path="purchasing/suppliers/new"
            element={
              <RequirePermission permission="suppliers.create">
                <SupplierFormPage />
              </RequirePermission>
            }
          />
          <Route
            path="purchasing/suppliers/:id"
            element={
              <RequirePermission permission="suppliers.read">
                <SupplierDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="purchasing/suppliers/:id/edit"
            element={
              <RequirePermission permission="suppliers.update">
                <SupplierFormPage />
              </RequirePermission>
            }
          />
          <Route
            path="purchasing/purchases"
            element={
              <RequirePermission permission="purchases.read">
                <PurchasesPage />
              </RequirePermission>
            }
          />
          <Route
            path="purchasing/purchases/new"
            element={
              <RequirePermission permission="purchases.create">
                <PurchaseFormPage />
              </RequirePermission>
            }
          />
          <Route
            path="purchasing/purchases/:id"
            element={
              <RequirePermission permission="purchases.read">
                <PurchaseDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="purchasing/purchases/:id/edit"
            element={
              <RequirePermission permission="purchases.update">
                <PurchaseFormPage />
              </RequirePermission>
            }
          />
          <Route
            path="purchasing/purchases/:id/receipts"
            element={
              <RequirePermission permission="purchases.receive">
                <PurchaseReceiptCreatePage />
              </RequirePermission>
            }
          />
          <Route
            path="purchasing/purchases/:id/returns"
            element={
              <RequirePermission permission="purchases.return">
                <PurchaseReturnCreatePage />
              </RequirePermission>
            }
          />
          <Route
            path="purchasing/purchases/:id/payments"
            element={
              <RequirePermission permission="purchases.read">
                <PurchasePaymentsPage />
              </RequirePermission>
            }
          />
          <Route
            path="purchasing/receipts/:id"
            element={
              <RequirePermission permission="purchases.read">
                <PurchaseReceiptDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="purchasing/returns/:id"
            element={
              <RequirePermission permission="purchases.read">
                <PurchaseReturnDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="commercial/payables"
            element={
              <RequirePermission permission="commercial-payables.read">
                <PayablesPage />
              </RequirePermission>
            }
          />
          <Route path="sales" element={<RequirePermission permission="sales.read"><SalesPage /></RequirePermission>} />
          <Route path="sales/new" element={<RequirePermission permission="sales.create"><SaleFormPage /></RequirePermission>} />
          <Route path="sales/:id" element={<RequirePermission permission="sales.read"><SaleDetailPage /></RequirePermission>} />
          <Route path="sales/:id/edit" element={<RequirePermission permission="sales.update"><SaleFormPage /></RequirePermission>} />
          <Route path="sales/:id/returns" element={<RequirePermission permission="sales.return"><SaleReturnCreatePage /></RequirePermission>} />
          <Route path="sales/:id/payments" element={<RequirePermission permission="sales.read"><SalePaymentsPage /></RequirePermission>} />
          <Route path="sales/returns/:id" element={<RequirePermission permission="sales.read"><SaleReturnDetailPage /></RequirePermission>} />
          <Route path="sales/returns/:id/refunds" element={<RequirePermission permission="sales.read"><SaleRefundsPage /></RequirePermission>} />
          <Route path="sales/customers" element={<RequirePermission permission="customers.read"><CustomersPage /></RequirePermission>} />
          <Route path="sales/customers/new" element={<RequirePermission permission="customers.create"><CustomerFormPage /></RequirePermission>} />
          <Route path="sales/customers/:id" element={<RequirePermission permission="customers.read"><CustomerDetailPage /></RequirePermission>} />
          <Route path="sales/customers/:id/edit" element={<RequirePermission permission="customers.update"><CustomerFormPage /></RequirePermission>} />
          <Route path="commercial/receivables" element={<RequirePermission permission="commercial-receivables.read"><ReceivablesPage /></RequirePermission>} />
          <Route path="customers/*" element={<Navigate to="/app/sales/customers" replace />} />
          <Route path="receivables/*" element={<Navigate to="/app/commercial/receivables" replace />} />
          <Route path="cash/registers" element={<RequirePermission permission="cash-registers.read"><CashRegistersPage /></RequirePermission>} />
          <Route path="cash/registers/new" element={<RequirePermission permission="cash-registers.manage"><CashRegisterFormPage /></RequirePermission>} />
          <Route path="cash/registers/:id" element={<RequirePermission permission="cash-registers.read"><CashRegisterDetailPage /></RequirePermission>} />
          <Route path="cash/registers/:id/edit" element={<RequirePermission permission="cash-registers.manage"><CashRegisterFormPage /></RequirePermission>} />
          <Route path="cash/sessions" element={<RequirePermission permission="cash-sessions.read"><CashSessionsPage /></RequirePermission>} />
          <Route path="cash/sessions/:id" element={<RequirePermission permission="cash-sessions.read"><CashSessionDetailPage /></RequirePermission>} />
          <Route path="cash/movements" element={<RequirePermission permission="cash-movements.read"><CashMovementsPage /></RequirePermission>} />
          <Route path="admin/users" element={<RequirePermission permission="users.read"><UsersPage /></RequirePermission>} />
          <Route path="admin/users/new" element={<RequirePermission permission="users.create"><UserFormPage /></RequirePermission>} />
          <Route path="admin/users/:id" element={<RequirePermission permission="users.read"><UserDetailPage /></RequirePermission>} />
          <Route path="admin/users/:id/edit" element={<RequirePermission permission="users.update"><UserFormPage /></RequirePermission>} />
          <Route path="admin/roles" element={<RequirePermission permission="roles.read"><RolesPage /></RequirePermission>} />
          <Route path="admin/roles/new" element={<RequirePermission permission="roles.manage"><RoleFormPage /></RequirePermission>} />
          <Route path="admin/roles/:id" element={<RequirePermission permission="roles.read"><RoleDetailPage /></RequirePermission>} />
          <Route path="admin/roles/:id/edit" element={<RequirePermission permission="roles.manage"><RoleFormPage /></RequirePermission>} />
          <Route path="cash" element={<Navigate to="/app/cash/registers" replace />} />
          <Route path="users/*" element={<Navigate to="/app/admin/users" replace />} />
          <Route path="roles/*" element={<Navigate to="/app/admin/roles" replace />} />
          <Route
            path="purchases/*"
            element={<Navigate to="/app/purchasing/purchases" replace />}
          />
          <Route
            path="suppliers/*"
            element={<Navigate to="/app/purchasing/suppliers" replace />}
          />
          <Route
            path="payables/*"
            element={<Navigate to="/app/commercial/payables" replace />}
          />
          <Route
            path="products/*"
            element={<Navigate to="/app/catalog/products" replace />}
          />
          <Route
            path="locations/*"
            element={<Navigate to="/app/inventory/locations" replace />}
          />
        </Route>
        <Route path="/forbidden" element={<ForbiddenPage />} />
      </Route>
      <Route path="/not-found" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/not-found" replace />} />
    </Routes>
  );
}
