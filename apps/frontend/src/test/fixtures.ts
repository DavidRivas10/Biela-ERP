import type {
  CommercialSummary,
  CurrentUser,
  SystemHealth,
} from "../types/api";

export const testUser: CurrentUser = {
  id: "user-1",
  email: "operator@example.com",
  firstName: "Ana",
  lastName: "López",
  active: true,
  roles: [
    {
      id: "role-1",
      name: "operator",
      permissions: ["products.read", "inventory.read"],
    },
  ],
};

export const systemHealth: SystemHealth = {
  status: "ok",
  services: {
    gateway: { status: "ok" },
    users: { status: "ok", service: "ms-users", database: "connected" },
    autorepuesto: {
      status: "ok",
      service: "ms-autorepuesto",
      database: "connected",
    },
  },
};

const totals = {
  documentCount: 2,
  grossAmount: "1250.00",
  returnAmount: "50.00",
  netAmount: "1200.00",
  paidAmount: "400.00",
  refundedAmount: "0.00",
  outstandingAmount: "800.00",
  creditAmount: "0.00",
  unpaidCount: 1,
  partiallyPaidCount: 1,
  paidCount: 0,
  overdueCount: 1,
  overdueAmount: "300.00",
  oldestDueDate: "2026-08-18T00:00:00.000Z",
};

export const commercialSummary: CommercialSummary = {
  businessDate: "2026-08-19",
  receivables: totals,
  payables: { ...totals, outstandingAmount: "475.50" },
  cash: { openSessionCount: 1, expectedCash: "250.25" },
};

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
