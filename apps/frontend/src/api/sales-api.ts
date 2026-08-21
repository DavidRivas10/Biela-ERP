import { apiRequest } from "./api-client";
import type { Paginated, QueryValue } from "../types/erp";
import type { Sale, SaleReturn } from "../types/sales";

export interface SaleInput {
  customerId?: string | null;
  documentDate: string;
  paymentDueDate?: string;
  notes?: string;
  items: Array<{
    productId: string;
    sourceLocationId: string;
    quantity: number;
    unitPrice?: string;
    discountAmount?: string;
    taxAmount?: string;
  }>;
}

export interface SaleReturnInput {
  reason: string;
  items: Array<{
    saleItemId: string;
    destinationLocationId: string;
    quantityReturned: number;
  }>;
}

export const salesApi = {
  list: (query: Record<string, QueryValue>) =>
    apiRequest<Paginated<Sale>>("/api/sales", { query }),
  detail: (id: string) => apiRequest<Sale>(`/api/sales/${id}`),
  create: (body: SaleInput) => apiRequest<Sale>("/api/sales", { method: "POST", body }),
  update: (id: string, body: Partial<SaleInput>) =>
    apiRequest<Sale>(`/api/sales/${id}`, { method: "PATCH", body }),
  post: (id: string) => apiRequest<Sale>(`/api/sales/${id}/post`, { method: "POST" }),
  cancel: (id: string) => apiRequest<Sale>(`/api/sales/${id}/cancel`, { method: "POST" }),
  returns: (saleId: string, query: Record<string, QueryValue>) =>
    apiRequest<Paginated<SaleReturn>>(`/api/sales/${saleId}/returns`, { query }),
  createReturn: (saleId: string, body: SaleReturnInput) =>
    apiRequest<SaleReturn>(`/api/sales/${saleId}/returns`, { method: "POST", body }),
  returnDetail: (id: string) => apiRequest<SaleReturn>(`/api/sale-returns/${id}`),
  postReturn: (id: string) =>
    apiRequest<SaleReturn>(`/api/sale-returns/${id}/post`, { method: "POST" }),
};
