import type { CommercialSummary, MoneySummary } from "../types/api";
import { apiRequest } from "./api-client";

export function getCommercialSummary(): Promise<CommercialSummary> {
  return apiRequest<CommercialSummary>("/api/commercial/summary");
}

export function getMoneySummary(params: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<MoneySummary> {
  return apiRequest<MoneySummary>("/api/commercial/money-summary", {
    query: params,
  });
}
