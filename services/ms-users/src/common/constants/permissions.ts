export const PERMISSIONS = {
  USERS_READ: "users.read",
  USERS_CREATE: "users.create",
  USERS_UPDATE: "users.update",
  USERS_ACTIVATE: "users.activate",
  USERS_DEACTIVATE: "users.deactivate",
  ROLES_READ: "roles.read",
  ROLES_MANAGE: "roles.manage",
} as const;

export const ADMIN_PERMISSIONS = Object.values(PERMISSIONS);
