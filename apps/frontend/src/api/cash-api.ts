import { apiRequest } from "./api-client";
import type { Paginated, QueryValue } from "../types/erp";
import type {
  CashMovement,
  CashMovementsPage,
  CashRegister,
  CashSession,
  CashSessionSummary,
} from "../types/cash";

export interface CashRegisterInput {
  code: string;
  name: string;
  description?: string;
  active?: boolean;
}

export const cashApi = {
  registers: (query: Record<string, QueryValue>) =>
    apiRequest<Paginated<CashRegister>>("/api/cash-registers", { query }),
  register: (id: string) =>
    apiRequest<CashRegister>(`/api/cash-registers/${id}`),
  createRegister: (body: CashRegisterInput) =>
    apiRequest<CashRegister>("/api/cash-registers", { method: "POST", body }),
  updateRegister: (id: string, body: CashRegisterInput) =>
    apiRequest<CashRegister>(`/api/cash-registers/${id}`, {
      method: "PATCH",
      body,
    }),
  setRegisterActive: (id: string, active: boolean) =>
    apiRequest<CashRegister>(
      `/api/cash-registers/${id}/${active ? "activate" : "deactivate"}`,
      { method: "PATCH" },
    ),
  currentSession: async (registerId: string) => {
    const response = await apiRequest<CashSession | Record<string, never> | null>(
      `/api/cash-registers/${registerId}/current-session`,
    );
    return response && "id" in response ? (response as CashSession) : null;
  },
  sessions: (query: Record<string, QueryValue>) =>
    apiRequest<Paginated<CashSession>>("/api/cash-sessions", { query }),
  session: (id: string) =>
    apiRequest<CashSession>(`/api/cash-sessions/${id}`),
  summary: (id: string) =>
    apiRequest<CashSessionSummary>(`/api/cash-sessions/${id}/summary`, {
      query: { includeMovements: false },
    }),
  openSession: (
    registerId: string,
    body: { openingAmount: string; notes?: string },
  ) =>
    apiRequest<CashSession>(
      `/api/cash-registers/${registerId}/sessions/open`,
      { method: "POST", body },
    ),
  closeSession: (
    id: string,
    body: { countedAmount: string; notes?: string },
  ) =>
    apiRequest<CashSession>(`/api/cash-sessions/${id}/close`, {
      method: "POST",
      body,
    }),
  movements: (query: Record<string, QueryValue>) =>
    apiRequest<CashMovementsPage>("/api/cash-movements", { query }),
  createMovement: (
    sessionId: string,
    body: { type: "MANUAL_IN" | "MANUAL_OUT"; amount: string; reason: string },
  ) =>
    apiRequest<CashMovement>(`/api/cash-sessions/${sessionId}/movements`, {
      method: "POST",
      body,
    }),
};
