import { ApiError } from "../api/api-client";

const BUSINESS_ERROR_TRANSLATIONS: Readonly<Record<string, string>> = {
  "Insufficient expected Cash in session":
    "El efectivo esperado de la sesión es insuficiente.",
};

export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) {
    return BUSINESS_ERROR_TRANSLATIONS[error.message] ?? error.message;
  }
  return "No fue posible completar la operación.";
}
