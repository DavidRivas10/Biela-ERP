import { apiRequest } from "./api-client";
import type { QueryValue } from "../types/erp";
import type { Customer, CustomerAccount } from "../types/sales";
import type { Paginated } from "../types/erp";

export interface CustomerInput {
  code: string;
  name: string;
  businessName?: string;
  taxId?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  active?: boolean;
}

export const customersApi = {
  list: (query: Record<string, QueryValue>) =>
    apiRequest<Paginated<Customer>>("/api/customers", { query }),
  detail: (id: string) => apiRequest<Customer>(`/api/customers/${id}`),
  create: (body: CustomerInput) =>
    apiRequest<Customer>("/api/customers", { method: "POST", body }),
  update: (id: string, body: Partial<CustomerInput>) =>
    apiRequest<Customer>(`/api/customers/${id}`, { method: "PATCH", body }),
  setActive: (id: string, active: boolean) =>
    apiRequest<Customer>(`/api/customers/${id}/${active ? "activate" : "deactivate"}`, {
      method: "PATCH",
    }),
  account: (id: string, query: Record<string, QueryValue>) =>
    apiRequest<CustomerAccount>(`/api/customers/${id}/account`, { query }),
};
