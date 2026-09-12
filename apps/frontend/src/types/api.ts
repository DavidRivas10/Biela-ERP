export interface AuthRole {
  id: string;
  name: string;
  permissions: string[];
}

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  active: boolean;
  roles: AuthRole[];
}

export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: string;
  user: CurrentUser;
}

export interface ServiceHealth {
  status: "ok" | "error";
  service?: string;
  database?: string;
}

export interface SystemHealth {
  status: "ok" | "degraded";
  services: {
    gateway: ServiceHealth;
    users: ServiceHealth;
    autorepuesto: ServiceHealth;
  };
}

export interface CommercialTotals {
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

export interface CommercialSummary {
  businessDate: string;
  receivables: CommercialTotals;
  payables: CommercialTotals;
  cash: {
    openSessionCount: number;
    expectedCash: string;
  };
  sales: {
    today: {
      count: number;
      total: string;
    };
  };
}

export interface MoneySummaryMethodAmount {
  paymentMethodId: string;
  code: string;
  name: string;
  kind: "CASH" | "CARD" | "BANK_TRANSFER" | "OTHER";
  amount: string;
}

export interface MoneySummaryOpenCashSession {
  id: string;
  cashRegisterCode: string;
  cashRegisterName: string;
  openedAt: string;
  openingAmount: string;
  expectedCash: string;
}

export interface MoneySummary {
  dateFrom: string;
  dateTo: string;
  salesCollected: { total: string; byMethod: MoneySummaryMethodAmount[] };
  receivablesCollected: { total: string; byMethod: MoneySummaryMethodAmount[] };
  purchasesPaid: { total: string; byMethod: MoneySummaryMethodAmount[] };
  openCashSessions: MoneySummaryOpenCashSession[];
}
