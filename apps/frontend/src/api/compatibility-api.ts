import { apiRequest } from "./api-client";
import type {
  Compatibility,
  NestedCompatibility,
  Paginated,
  Product,
  QueryValue,
  Vehicle,
} from "../types/erp";

export const compatibilityApi = {
  list: (query: Record<string, QueryValue>) =>
    apiRequest<Paginated<Compatibility>>("/api/compatibilities", { query }),
  create: (body: {
    productId: string;
    vehicleId: string;
    notes?: string;
    active?: boolean;
  }) =>
    apiRequest<Compatibility>("/api/compatibilities", { method: "POST", body }),
  update: (id: string, body: { notes?: string; active?: boolean }) =>
    apiRequest<Compatibility>(`/api/compatibilities/${id}`, {
      method: "PATCH",
      body,
    }),
  productVehicles: (id: string, query: Record<string, QueryValue>) =>
    apiRequest<Paginated<Vehicle & { compatibility: NestedCompatibility }>>(
      `/api/products/${id}/vehicles`,
      { query },
    ),
  vehicleProducts: (id: string, query: Record<string, QueryValue>) =>
    apiRequest<Paginated<Product & { compatibility: NestedCompatibility }>>(
      `/api/vehicles/${id}/products`,
      { query },
    ),
};
