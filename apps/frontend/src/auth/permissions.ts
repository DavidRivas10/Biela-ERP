import type { CurrentUser } from "../types/api";

export function permissionsOf(user: CurrentUser | null): Set<string> {
  return new Set(user?.roles.flatMap((role) => role.permissions) ?? []);
}

export function hasPermission(
  user: CurrentUser | null,
  permission: string,
): boolean {
  return permissionsOf(user).has(permission);
}

export function hasAnyPermission(
  user: CurrentUser | null,
  permissions: readonly string[],
): boolean {
  const granted = permissionsOf(user);
  return permissions.some((permission) => granted.has(permission));
}

export function hasAllPermissions(
  user: CurrentUser | null,
  permissions: readonly string[],
): boolean {
  const granted = permissionsOf(user);
  return permissions.every((permission) => granted.has(permission));
}
