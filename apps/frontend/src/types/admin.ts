import type { Paginated } from "./erp";

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  active: boolean;
  roles: Array<Pick<Role, "id" | "name" | "permissions">>;
}

export type UsersPage = Paginated<User>;
