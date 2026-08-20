import type { CommercialSummary } from "../types/api";
import { apiRequest } from "./api-client";

export function getCommercialSummary(): Promise<CommercialSummary> {
  return apiRequest<CommercialSummary>("/api/commercial/summary");
}
