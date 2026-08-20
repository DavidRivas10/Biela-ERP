import type { SystemHealth } from "../types/api";
import { apiRequest } from "./api-client";

export function getSystemHealth(): Promise<SystemHealth> {
  return apiRequest<SystemHealth>("/api/system/health", {
    authenticated: false,
  });
}
