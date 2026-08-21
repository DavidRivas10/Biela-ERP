import type { Paginated, Product, Location } from "./erp";

export interface Supplier {
  id: string;
  code: string;
  businessName: string;
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

export type PurchaseStatus =
  "DRAFT" | "CONFIRMED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
export type PurchasingDocumentStatus = "DRAFT" | "POSTED" | "CANCELLED";
export type SettlementStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";
export type PaymentMethodKind = "CASH" | "CARD" | "BANK_TRANSFER" | "OTHER";
export type PaymentStatus = "POSTED" | "REVERSED";
export type PaymentType =
  "PURCHASE_PAYMENT" | "SUPPLIER_REFUND" | "SALE_PAYMENT" | "SALE_REFUND";

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  productId: string;
  product: Product;
  orderedQuantity: number;
  unitCost: string;
  discountAmount: string;
  taxAmount: string;
  lineSubtotal: string;
  lineTotal: string;
  receivedQuantity: number;
  returnedQuantity: number;
  remainingReceivableQuantity: number;
}

export interface FinancialSummary {
  grossPurchaseValue: string;
  purchaseReturnValue: string;
  netPurchaseObligation: string;
  paidAmount: string;
  supplierRefundedAmount: string;
  netPaidAmount: string;
  outstandingAmount: string;
  supplierCreditAmount: string;
  settlementStatus: SettlementStatus;
}

export interface PurchaseReceiptSummary {
  id: string;
  number: number;
  status: PurchasingDocumentStatus;
  destinationLocation: Location;
  receivedAt: string;
  postedAt?: string | null;
}

export interface PurchaseReturnSummary {
  id: string;
  number: number;
  status: PurchasingDocumentStatus;
  reason: string;
  postedAt?: string | null;
}

export interface Purchase {
  id: string;
  number: number;
  supplierId: string;
  supplier: Supplier;
  supplierDocumentNumber?: string | null;
  documentDate: string;
  paymentDueDate?: string | null;
  status: PurchaseStatus;
  notes?: string | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  items?: PurchaseItem[];
  receiptSummary?: PurchaseReceiptSummary[];
  returnSummary?: PurchaseReturnSummary[];
  paymentSummary?: FinancialSummary;
  _count?: { items: number };
}

export interface PurchaseReceiptItem {
  id: string;
  purchaseItemId: string;
  quantityReceived: number;
  purchaseItem: PurchaseItem;
}

export interface PurchaseReceipt {
  id: string;
  number: number;
  purchaseId: string;
  purchase: Pick<Purchase, "id" | "number" | "status">;
  destinationLocationId: string;
  destinationLocation: Location;
  receivedAt: string;
  status: PurchasingDocumentStatus;
  notes?: string | null;
  postedAt?: string | null;
  createdAt: string;
  items: PurchaseReceiptItem[];
  inventoryMovements?: Array<{ id: string; quantity: number }>;
}

export interface PurchaseReturnItem {
  id: string;
  purchaseItemId: string;
  sourceLocationId: string;
  sourceLocation: Location;
  quantityReturned: number;
  purchaseItem: PurchaseItem;
}

export interface RefundSummary {
  returnValue: string;
  refundedAmount: string;
  refundableAmount: string;
}

export interface PurchaseReturn {
  id: string;
  number: number;
  purchaseId: string;
  purchase: Pick<Purchase, "id" | "number" | "status">;
  status: PurchasingDocumentStatus;
  reason: string;
  postedAt?: string | null;
  createdAt: string;
  items: PurchaseReturnItem[];
  inventoryMovements?: Array<{ id: string; quantity: number }>;
  refundSummary?: RefundSummary;
}

export interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  kind: PaymentMethodKind;
  active: boolean;
  notes?: string | null;
}

export interface CashRegister {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface CashSession {
  id: string;
  status: "OPEN" | "CLOSED";
  cashRegisterId: string;
  cashRegister: CashRegister;
  openingAmount: string;
  openedAt: string;
  openedByActorId: string;
}

export interface Payment {
  id: string;
  number: number;
  type: PaymentType;
  status: PaymentStatus;
  amount: string;
  paymentMethodId: string;
  paymentMethod: PaymentMethod;
  cashSessionId?: string | null;
  cashSession?: CashSession | null;
  externalReference?: string | null;
  notes?: string | null;
  createdByActorId: string;
  createdAt: string;
  reversedAt?: string | null;
  reversalReason?: string | null;
  purchaseId?: string | null;
  purchaseReturnId?: string | null;
  saleId?: string | null;
  saleReturnId?: string | null;
  tenderedAmount?: string | null;
  changeAmount?: string | null;
  reversalCashSession?: CashSession | null;
}

export interface CommercialSummaryTotals {
  documentCount: number;
  grossAmount: string;
  returnAmount: string;
  netAmount: string;
  paidAmount: string;
  refundedAmount: string;
  outstandingAmount: string;
  creditAmount: string;
  unpaidCount: number;
  partiallyPaidCount: number;
  paidCount: number;
  overdueCount: number;
  overdueAmount: string;
  oldestDueDate: string | null;
}

export interface PayableDocument {
  id: string;
  number: number;
  documentDate: string;
  paymentDueDate?: string | null;
  supplierId: string;
  supplier: Pick<Supplier, "id" | "code" | "businessName" | "active">;
  grossPurchaseValue: string;
  purchaseReturnValue: string;
  netPurchaseObligation: string;
  paidAmount: string;
  supplierRefundedAmount: string;
  netPaidAmount: string;
  outstandingAmount: string;
  supplierCreditAmount: string;
  settlementStatus: SettlementStatus;
  overdue: boolean;
  ageInDays: number;
}

export interface PayablesPage extends Paginated<PayableDocument> {
  summary: CommercialSummaryTotals;
  businessDate: string;
}

export interface SupplierAccount extends PayablesPage {
  supplier: Supplier;
}
