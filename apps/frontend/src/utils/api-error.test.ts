import { describe, expect, it } from "vitest";
import { ApiError } from "../api/api-client";
import { apiErrorMessage } from "./api-error";

describe("apiErrorMessage", () => {
  it("presents the insufficient Cash business rejection in Spanish", () => {
    expect(
      apiErrorMessage(
        new ApiError("Insufficient expected Cash in session", 409),
      ),
    ).toBe("El efectivo esperado de la sesión es insuficiente.");
  });

  it("preserves other API messages and provides a safe fallback", () => {
    expect(apiErrorMessage(new ApiError("Duplicate record", 409))).toBe(
      "Duplicate record",
    );
    expect(apiErrorMessage(null)).toBe(
      "No fue posible completar la operación.",
    );
  });
});
