import { ApiError } from "../api/api-client";

export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return "No fue posible completar la operación.";
}
