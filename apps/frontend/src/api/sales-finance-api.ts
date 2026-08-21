import { apiRequest } from "./api-client";
import type { Paginated, QueryValue } from "../types/erp";
import type { ReceivablesPage, SalePayment } from "../types/sales";

export interface SaleFinancialOperationInput {
  paymentMethodId: string;
  amount: string;
  cashSessionId?: string;
  tenderedAmount?: string;
  externalReference?: string;
  notes?: string;
}

export const salesFinanceApi = {
  payments: (saleId: string, query: Record<string, QueryValue>) =>
    apiRequest<Paginated<SalePayment>>(`/api/sales/${saleId}/payments`, { query }),
  createPayment: (saleId: string, body: SaleFinancialOperationInput) =>
    apiRequest<SalePayment>(`/api/sales/${saleId}/payments`, { method: "POST", body }),
  refunds: (returnId: string, query: Record<string, QueryValue>) =>
    apiRequest<Paginated<SalePayment>>(`/api/sale-returns/${returnId}/refunds`, { query }),
  createRefund: (returnId: string, body: SaleFinancialOperationInput) =>
    apiRequest<SalePayment>(`/api/sale-returns/${returnId}/refunds`, { method: "POST", body }),
  reverse: (id: string, body: { reason: string; cashSessionId?: string }) =>
    apiRequest<SalePayment>(`/api/payments/${id}/reverse`, { method: "POST", body }),
  receivables: (query: Record<string, QueryValue>) =>
    apiRequest<ReceivablesPage>("/api/commercial/receivables", { query }),
};
