import { apiRequest } from "./api-client";
import type {
  InventoryBalance,
  InventoryMovement,
  InventoryMovementType,
  Location,
  Paginated,
  ProductInventory,
  QueryValue,
} from "../types/erp";

export interface LocationInput {
  code: string;
  name: string;
  description?: string;
  zone?: string;
  aisle?: string;
  rack?: string;
  shelf?: string;
  bin?: string;
  active?: boolean;
}
export interface MovementInput {
  type: InventoryMovementType;
  productId: string;
  sourceLocationId?: string;
  destinationLocationId?: string;
  quantity: number;
  reason?: string;
}

export const inventoryApi = {
  locations: (query: Record<string, QueryValue>) =>
    apiRequest<Paginated<Location>>("/api/locations", { query }),
  location: (id: string) => apiRequest<Location>(`/api/locations/${id}`),
  createLocation: (body: LocationInput) =>
    apiRequest<Location>("/api/locations", { method: "POST", body }),
  updateLocation: (id: string, body: Partial<LocationInput>) =>
    apiRequest<Location>(`/api/locations/${id}`, { method: "PATCH", body }),
  setLocationActive: (id: string, active: boolean) =>
    apiRequest<Location>(
      `/api/locations/${id}/${active ? "activate" : "deactivate"}`,
      { method: "PATCH" },
    ),
  balances: (query: Record<string, QueryValue>) =>
    apiRequest<Paginated<InventoryBalance>>("/api/inventory", { query }),
  productBalances: (id: string, query: Record<string, QueryValue>) =>
    apiRequest<ProductInventory>(`/api/products/${id}/inventory`, { query }),
  locationBalances: (id: string, query: Record<string, QueryValue>) =>
    apiRequest<Paginated<InventoryBalance>>(`/api/locations/${id}/inventory`, {
      query,
    }),
  movements: (query: Record<string, QueryValue>) =>
    apiRequest<Paginated<InventoryMovement>>("/api/inventory/movements", {
      query,
    }),
  createMovement: (body: MovementInput) =>
    apiRequest<InventoryMovement>("/api/inventory/movements", {
      method: "POST",
      body,
    }),
};
