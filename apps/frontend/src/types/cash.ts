import type { Paginated } from "./erp";

export interface CashRegister {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CashSessionStatus = "OPEN" | "CLOSED";

export interface CashSession {
  id: string;
  cashRegisterId: string;
  cashRegister: CashRegister;
  status: CashSessionStatus;
  openingAmount: string;
  openedByActorId: string;
  openedAt: string;
  openingNotes?: string | null;
  closedByActorId?: string | null;
  closedAt?: string | null;
  expectedAmount?: string | null;
  countedAmount?: string | null;
  differenceAmount?: string | null;
  closingNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CashMovementType =
  | "SALE_PAYMENT"
  | "SALE_PAYMENT_REVERSAL"
  | "SALE_REFUND"
  | "SALE_REFUND_REVERSAL"
  | "PURCHASE_PAYMENT"
  | "PURCHASE_PAYMENT_REVERSAL"
  | "SUPPLIER_REFUND"
  | "SUPPLIER_REFUND_REVERSAL"
  | "MANUAL_IN"
  | "MANUAL_OUT";

export interface CashMovementPayment {
  id: string;
  number: number;
  saleId?: string | null;
  saleReturnId?: string | null;
  purchaseId?: string | null;
  purchaseReturnId?: string | null;
  externalReference?: string | null;
  paymentMethod?: { id: string; code: string; name: string; kind: string };
}

export interface CashMovement {
  id: string;
  cashSessionId: string;
  cashSession: CashSession;
  paymentId?: string | null;
  payment?: CashMovementPayment | null;
  type: CashMovementType;
  amount: string;
  reason?: string | null;
  actorId: string;
  createdAt: string;
}

export interface CashSessionSummary extends CashSession {
  movements: CashMovement[];
  movementTotals: Record<CashMovementType, string>;
  expectedCash: string;
  paymentTotalsByMethod: Array<{
    paymentMethod: { id: string; code: string; name: string; kind: string };
    payments: string;
    refunds: string;
    purchasePayments: string;
    supplierRefunds: string;
  }>;
}

export type CashMovementsPage = Paginated<CashMovement>;
