import { apiRequest } from "./api-client";
import type { Paginated, QueryValue } from "../types/erp";
import type {
  CashSession,
  PayablesPage,
  Payment,
  PaymentMethod,
} from "../types/purchasing";

export interface FinancialOperationInput {
  paymentMethodId: string;
  amount: string;
  cashSessionId?: string;
  externalReference?: string;
  notes?: string;
}

export const purchasingFinanceApi = {
  paymentMethods: (query: Record<string, QueryValue>) =>
    apiRequest<Paginated<PaymentMethod>>("/api/payment-methods", { query }),
  paymentMethod: (id: string) =>
    apiRequest<PaymentMethod>(`/api/payment-methods/${id}`),
  cashSessions: (query: Record<string, QueryValue>) =>
    apiRequest<Paginated<CashSession>>("/api/cash-sessions", { query }),
  cashSession: (id: string) =>
    apiRequest<CashSession>(`/api/cash-sessions/${id}`),
  purchasePayments: (purchaseId: string, query: Record<string, QueryValue>) =>
    apiRequest<Paginated<Payment>>(`/api/purchases/${purchaseId}/payments`, {
      query,
    }),
  createPurchasePayment: (purchaseId: string, body: FinancialOperationInput) =>
    apiRequest<Payment>(`/api/purchases/${purchaseId}/payments`, {
      method: "POST",
      body,
    }),
  supplierRefunds: (returnId: string, query: Record<string, QueryValue>) =>
    apiRequest<Paginated<Payment>>(
      `/api/purchase-returns/${returnId}/refunds`,
      { query },
    ),
  createSupplierRefund: (returnId: string, body: FinancialOperationInput) =>
    apiRequest<Payment>(`/api/purchase-returns/${returnId}/refunds`, {
      method: "POST",
      body,
    }),
  reverse: (id: string, body: { reason: string; cashSessionId?: string }) =>
    apiRequest<Payment>(`/api/payments/${id}/reverse`, {
      method: "POST",
      body,
    }),
  payables: (query: Record<string, QueryValue>) =>
    apiRequest<PayablesPage>("/api/commercial/payables", { query }),
};
