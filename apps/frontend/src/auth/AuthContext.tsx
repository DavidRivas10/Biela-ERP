import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { currentUserRequest, loginRequest } from "../api/auth-api";
import {
  ApiError,
  isApiUnavailable,
  subscribeUnauthorized,
} from "../api/api-client";
import type { CurrentUser } from "../types/api";
import {
  hasAllPermissions as userHasAllPermissions,
  hasAnyPermission as userHasAnyPermission,
  hasPermission as userHasPermission,
  permissionsOf,
} from "./permissions";
import { tokenStorage } from "./token-storage";

export type AuthStatus =
  "loading" | "authenticated" | "anonymous" | "unavailable";

export interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  permissions: ReadonlySet<string>;
  isAuthenticated: boolean;
  isInitializing: boolean;
  restoreError: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  retryRestore: () => void;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: readonly string[]) => boolean;
  hasAllPermissions: (permissions: readonly string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function unavailableMessage(error: unknown): string {
  if (isApiUnavailable(error)) {
    return "Tu sesión sigue guardada, pero el servicio no está disponible. Intenta nuevamente.";
  }
  return "No fue posible validar tu sesión. Revisa tu conexión e intenta nuevamente.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() =>
    tokenStorage.get() ? "loading" : "anonymous",
  );
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const logout = useCallback(() => {
    tokenStorage.clear();
    queryClient.clear();
    setUser(null);
    setRestoreError(null);
    setStatus("anonymous");
  }, [queryClient]);

  const restore = useCallback(async () => {
    if (!tokenStorage.get()) {
      setStatus("anonymous");
      return;
    }
    setStatus("loading");
    setRestoreError(null);
    try {
      const currentUser = await currentUserRequest();
      setUser(currentUser);
      setStatus("authenticated");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout();
        return;
      }
      setUser(null);
      setRestoreError(unavailableMessage(error));
      setStatus("unavailable");
    }
  }, [logout]);

  useEffect(() => {
    if (tokenStorage.get()) void Promise.resolve().then(restore);
  }, [restore]);

  useEffect(() => subscribeUnauthorized(logout), [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password);
    tokenStorage.set(response.accessToken);
    setRestoreError(null);
    setUser(response.user);
    setStatus("authenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      permissions: permissionsOf(user),
      isAuthenticated: status === "authenticated",
      isInitializing: status === "loading",
      restoreError,
      login,
      logout,
      retryRestore: () => void restore(),
      hasPermission: (permission) => userHasPermission(user, permission),
      hasAnyPermission: (permissions) =>
        userHasAnyPermission(user, permissions),
      hasAllPermissions: (permissions) =>
        userHasAllPermissions(user, permissions),
    }),
    [login, logout, restore, restoreError, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("useAuth debe utilizarse dentro de AuthProvider.");
  return context;
}
