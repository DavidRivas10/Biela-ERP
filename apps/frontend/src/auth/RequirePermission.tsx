import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { hasPermission } from "./permissions";

export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { user } = useAuth();
  return hasPermission(user, permission) ? (
    children
  ) : (
    <Navigate to="/forbidden" replace />
  );
}
