import { apiRequest } from "./api-client";
import type { Paginated, QueryValue } from "../types/erp";
import type { Supplier, SupplierAccount } from "../types/purchasing";

export interface SupplierInput {
  code: string;
  businessName: string;
  taxId?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  active?: boolean;
}

export const suppliersApi = {
  list: (query: Record<string, QueryValue>) =>
    apiRequest<Paginated<Supplier>>("/api/suppliers", { query }),
  detail: (id: string) => apiRequest<Supplier>(`/api/suppliers/${id}`),
  create: (body: SupplierInput) =>
    apiRequest<Supplier>("/api/suppliers", { method: "POST", body }),
  update: (id: string, body: Partial<SupplierInput>) =>
    apiRequest<Supplier>(`/api/suppliers/${id}`, { method: "PATCH", body }),
  setActive: (id: string, active: boolean) =>
    apiRequest<Supplier>(
      `/api/suppliers/${id}/${active ? "activate" : "deactivate"}`,
      { method: "PATCH" },
    ),
  account: (id: string, query: Record<string, QueryValue>) =>
    apiRequest<SupplierAccount>(`/api/suppliers/${id}/account`, { query }),
};
