import type { CurrentUser, LoginResponse } from "../types/api";
import { apiRequest } from "./api-client";

export function loginRequest(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
    authenticated: false,
  });
}

export function currentUserRequest(): Promise<CurrentUser> {
  return apiRequest<CurrentUser>("/api/auth/me", {
    handleUnauthorized: false,
  });
}
