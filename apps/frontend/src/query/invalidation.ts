import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";

export async function invalidateProductReferenceIntegration(
  client: QueryClient,
) {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.productsRoot }),
    client.invalidateQueries({ queryKey: queryKeys.productDetailsRoot }),
    client.invalidateQueries({ queryKey: queryKeys.compatibilitiesRoot }),
    client.invalidateQueries({ queryKey: queryKeys.inventoryDomainRoot }),
    client.invalidateQueries({ queryKey: queryKeys.searchRoot }),
  ]);
}

export async function invalidateVehicleReferenceIntegration(
  client: QueryClient,
) {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.vehiclesRoot }),
    client.invalidateQueries({ queryKey: queryKeys.vehicleDetailsRoot }),
    client.invalidateQueries({ queryKey: queryKeys.compatibilitiesRoot }),
    client.invalidateQueries({ queryKey: queryKeys.searchRoot }),
  ]);
}

export async function invalidateLocationReferenceIntegration(
  client: QueryClient,
) {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.inventoryDomainRoot }),
    client.invalidateQueries({ queryKey: queryKeys.purchaseDetailsRoot }),
    client.invalidateQueries({ queryKey: queryKeys.saleDetailsRoot }),
  ]);
}

export async function invalidateSupplierReferenceIntegration(
  client: QueryClient,
) {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.suppliersRoot }),
    client.invalidateQueries({ queryKey: queryKeys.supplierDetailsRoot }),
    client.invalidateQueries({ queryKey: queryKeys.purchasesRoot }),
    client.invalidateQueries({ queryKey: queryKeys.purchaseDetailsRoot }),
    client.invalidateQueries({ queryKey: queryKeys.payablesRoot }),
    client.invalidateQueries({ queryKey: queryKeys.supplierAccountsRoot }),
  ]);
}

export async function invalidateCustomerReferenceIntegration(
  client: QueryClient,
) {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.customersRoot }),
    client.invalidateQueries({ queryKey: queryKeys.customerDetailsRoot }),
    client.invalidateQueries({ queryKey: queryKeys.salesRoot }),
    client.invalidateQueries({ queryKey: queryKeys.saleDetailsRoot }),
    client.invalidateQueries({ queryKey: queryKeys.receivablesRoot }),
    client.invalidateQueries({ queryKey: queryKeys.customerAccountsRoot }),
  ]);
}

export async function invalidateInventoryIntegration(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.inventoryDomainRoot }),
    client.invalidateQueries({ queryKey: queryKeys.searchRoot }),
  ]);
}

export async function invalidateCommercialSummary(client: QueryClient) {
  await client.invalidateQueries({ queryKey: queryKeys.commercialSummary });
}

export async function invalidateCashIntegration(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.cashSessionsRoot }),
    client.invalidateQueries({ queryKey: queryKeys.cashSessionDetailsRoot }),
    client.invalidateQueries({ queryKey: queryKeys.cashMovementsRoot }),
    invalidateCommercialSummary(client),
  ]);
}

export async function invalidateUserRoleIntegration(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.usersRoot }),
    client.invalidateQueries({ queryKey: queryKeys.userDetailsRoot }),
  ]);
}
