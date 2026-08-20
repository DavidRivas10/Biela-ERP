import { apiRequest } from "./api-client";
import type {
  Paginated,
  QueryValue,
  Vehicle,
  VehicleBrand,
  VehicleModel,
} from "../types/erp";

export interface VehicleBrandInput {
  code: string;
  name: string;
  active?: boolean;
}
export interface VehicleModelInput extends VehicleBrandInput {
  brandId: string;
}
export interface VehicleInput {
  modelId: string;
  year: number;
  engine: string;
  generation?: string;
  trim?: string;
  active?: boolean;
}

export const vehiclesApi = {
  brands: () => apiRequest<VehicleBrand[]>("/api/vehicle-brands"),
  createBrand: (body: VehicleBrandInput) =>
    apiRequest<VehicleBrand>("/api/vehicle-brands", { method: "POST", body }),
  updateBrand: (id: string, body: Partial<VehicleBrandInput>) =>
    apiRequest<VehicleBrand>(`/api/vehicle-brands/${id}`, {
      method: "PATCH",
      body,
    }),
  models: (brandId?: string) =>
    apiRequest<VehicleModel[]>("/api/vehicle-models", { query: { brandId } }),
  createModel: (body: VehicleModelInput) =>
    apiRequest<VehicleModel>("/api/vehicle-models", { method: "POST", body }),
  updateModel: (id: string, body: Partial<VehicleModelInput>) =>
    apiRequest<VehicleModel>(`/api/vehicle-models/${id}`, {
      method: "PATCH",
      body,
    }),
  vehicles: (query: Record<string, QueryValue>) =>
    apiRequest<Paginated<Vehicle>>("/api/vehicles", { query }),
  vehicle: (id: string) => apiRequest<Vehicle>(`/api/vehicles/${id}`),
  createVehicle: (body: VehicleInput) =>
    apiRequest<Vehicle>("/api/vehicles", { method: "POST", body }),
  updateVehicle: (id: string, body: Partial<VehicleInput>) =>
    apiRequest<Vehicle>(`/api/vehicles/${id}`, { method: "PATCH", body }),
  setVehicleActive: (id: string, active: boolean) =>
    apiRequest<Vehicle>(
      `/api/vehicles/${id}/${active ? "activate" : "deactivate"}`,
      { method: "PATCH" },
    ),
};
