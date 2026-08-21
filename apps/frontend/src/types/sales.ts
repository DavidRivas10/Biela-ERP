import type { Location, Paginated, Product } from "./erp";
import type {
  CashSession,
  CommercialSummaryTotals,
  Payment,
  SettlementStatus,
} from "./purchasing";

export interface Customer {
  id: string;
  code: string;
  name: string;
  businessName?: string | null;
  taxId?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SaleStatus = "DRAFT" | "POSTED" | "CANCELLED";

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  sourceLocationId: string;
  product: Product;
  sourceLocation: Location;
  quantity: number;
  unitPrice: string;
  discountAmount: string;
  taxAmount: string;
  lineSubtotal: string;
  lineTotal: string;
  returnedQuantity: number;
  netQuantity: number;
}

export interface SaleFinancialSummary {
  saleTotal: string;
  paidAmount: string;
  outstandingAmount: string;
  refundedAmount: string;
  settlementStatus: SettlementStatus;
}

export interface Sale {
  id: string;
  number: number;
  customerId?: string | null;
  customer?: Customer | null;
  walkIn?: boolean;
  documentDate: string;
  paymentDueDate?: string | null;
  status: SaleStatus;
  notes?: string | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  createdAt: string;
  updatedAt: string;
  postedAt?: string | null;
  cancelledAt?: string | null;
  items?: SaleItem[];
  returns?: SaleReturn[];
  inventoryMovements?: Array<{ id: string; quantity: number }>;
  paymentSummary?: SaleFinancialSummary;
  _count?: { items: number; returns: number };
}

export interface SaleReturnItem {
  id: string;
  saleReturnId: string;
  saleItemId: string;
  destinationLocationId: string;
  destinationLocation: Location;
  saleItem: SaleItem;
  quantityReturned: number;
}

export interface SaleRefundSummary {
  returnValue: string;
  refundedAmount: string;
  refundableAmount: string;
}

export interface SaleReturn {
  id: string;
  number: number;
  saleId: string;
  sale: Pick<Sale, "id" | "number" | "status" | "customerId">;
  status: SaleStatus;
  reason: string;
  postedAt?: string | null;
  createdAt: string;
  items: SaleReturnItem[];
  inventoryMovements?: Array<{ id: string; quantity: number }>;
  refundSummary?: SaleRefundSummary;
}

export interface ReceivableDocument {
  id: string;
  number: number;
  documentDate: string;
  paymentDueDate?: string | null;
  customerId?: string | null;
  customer?: Pick<Customer, "id" | "code" | "name" | "businessName" | "active"> | null;
  walkIn: boolean;
  total: string;
  paidAmount: string;
  refundedAmount: string;
  outstandingAmount: string;
  settlementStatus: SettlementStatus;
  overdue: boolean;
  ageInDays: number;
}

export interface ReceivablesPage extends Paginated<ReceivableDocument> {
  summary: CommercialSummaryTotals;
  businessDate: string;
}

export interface CustomerAccount extends ReceivablesPage {
  customer: Customer;
}

export interface SalePayment extends Payment {
  saleId?: string | null;
  saleReturnId?: string | null;
  tenderedAmount?: string | null;
  changeAmount?: string | null;
  reversalCashSession?: CashSession | null;
}
