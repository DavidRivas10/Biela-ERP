import { apiRequest } from "./api-client";
import type { Role, User, UsersPage } from "../types/admin";
import type { QueryValue } from "../types/erp";

export interface UserInput {
  email: string;
  firstName: string;
  lastName: string;
  roleIds?: string[];
  password?: string;
}

export interface RoleInput {
  name: string;
  description: string;
  permissions: string[];
  active?: boolean;
}

type RawRole = Omit<Role, "id"> & { id?: string; _id?: string };
const normalizeRole = (role: RawRole): Role => ({
  ...role,
  id: role.id ?? role._id ?? "",
});

export const usersApi = {
  list: (query: Record<string, QueryValue>) =>
    apiRequest<UsersPage>("/api/users", { query }),
  detail: (id: string) => apiRequest<User>(`/api/users/${id}`),
  create: (body: UserInput & { password: string }) =>
    apiRequest<User>("/api/users", { method: "POST", body }),
  update: (id: string, body: UserInput) =>
    apiRequest<User>(`/api/users/${id}`, { method: "PATCH", body }),
  setActive: (id: string, active: boolean) =>
    apiRequest<User>(`/api/users/${id}/${active ? "activate" : "deactivate"}`, {
      method: "PATCH",
    }),
  /**
   * Admin-driven reset. The response carries the new temporary password ONCE;
   * show it to the administrator and never persist it (no query cache).
   */
  resetPassword: (id: string) =>
    apiRequest<{ user: User; temporaryPassword: string }>(
      `/api/users/${id}/reset-password`,
      { method: "POST" },
    ),
};

export const rolesApi = {
  list: async () =>
    (await apiRequest<RawRole[]>("/api/roles")).map(normalizeRole),
  detail: async (id: string) =>
    normalizeRole(await apiRequest<RawRole>(`/api/roles/${id}`)),
  create: async (body: RoleInput) =>
    normalizeRole(
      await apiRequest<RawRole>("/api/roles", { method: "POST", body }),
    ),
  update: async (id: string, body: RoleInput) =>
    normalizeRole(
      await apiRequest<RawRole>(`/api/roles/${id}`, { method: "PATCH", body }),
    ),
};
