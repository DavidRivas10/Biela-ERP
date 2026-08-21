import { apiRequest } from "./api-client";
import type { Paginated, QueryValue } from "../types/erp";
import type {
  Purchase,
  PurchaseReceipt,
  PurchaseReturn,
} from "../types/purchasing";

export interface PurchaseItemInput {
  productId: string;
  orderedQuantity: number;
  unitCost: string;
  discountAmount?: string;
  taxAmount?: string;
}
export interface PurchaseInput {
  supplierId: string;
  supplierDocumentNumber?: string;
  documentDate: string;
  paymentDueDate?: string;
  notes?: string;
  items: PurchaseItemInput[];
}
export interface ReceiptInput {
  destinationLocationId: string;
  receivedAt?: string;
  notes?: string;
  items: Array<{ purchaseItemId: string; quantityReceived: number }>;
}
export interface ReturnInput {
  reason: string;
  items: Array<{
    purchaseItemId: string;
    sourceLocationId: string;
    quantityReturned: number;
  }>;
}

export const purchasingApi = {
  purchases: (query: Record<string, QueryValue>) =>
    apiRequest<Paginated<Purchase>>("/api/purchases", { query }),
  purchase: (id: string) => apiRequest<Purchase>(`/api/purchases/${id}`),
  createPurchase: (body: PurchaseInput) =>
    apiRequest<Purchase>("/api/purchases", { method: "POST", body }),
  updatePurchase: (id: string, body: Partial<PurchaseInput>) =>
    apiRequest<Purchase>(`/api/purchases/${id}`, { method: "PATCH", body }),
  confirmPurchase: (id: string) =>
    apiRequest<Purchase>(`/api/purchases/${id}/confirm`, { method: "POST" }),
  cancelPurchase: (id: string) =>
    apiRequest<Purchase>(`/api/purchases/${id}/cancel`, { method: "POST" }),
  receipts: (purchaseId: string, query: Record<string, QueryValue>) =>
    apiRequest<Paginated<PurchaseReceipt>>(
      `/api/purchases/${purchaseId}/receipts`,
      { query },
    ),
  receipt: (id: string) =>
    apiRequest<PurchaseReceipt>(`/api/purchase-receipts/${id}`),
  createReceipt: (purchaseId: string, body: ReceiptInput) =>
    apiRequest<PurchaseReceipt>(`/api/purchases/${purchaseId}/receipts`, {
      method: "POST",
      body,
    }),
  postReceipt: (id: string) =>
    apiRequest<PurchaseReceipt>(`/api/purchase-receipts/${id}/post`, {
      method: "POST",
    }),
  returns: (purchaseId: string, query: Record<string, QueryValue>) =>
    apiRequest<Paginated<PurchaseReturn>>(
      `/api/purchases/${purchaseId}/returns`,
      { query },
    ),
  purchaseReturn: (id: string) =>
    apiRequest<PurchaseReturn>(`/api/purchase-returns/${id}`),
  createReturn: (purchaseId: string, body: ReturnInput) =>
    apiRequest<PurchaseReturn>(`/api/purchases/${purchaseId}/returns`, {
      method: "POST",
      body,
    }),
  postReturn: (id: string) =>
    apiRequest<PurchaseReturn>(`/api/purchase-returns/${id}/post`, {
      method: "POST",
    }),
};
