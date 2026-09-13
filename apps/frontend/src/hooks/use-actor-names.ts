import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { usersApi } from "../api/admin-api";
import { useAuth } from "../auth/AuthContext";
import { queryKeys } from "../query/query-keys";

const ACTOR_NAMES_PARAMS = { page: 1, limit: 100 };

/**
 * Resolves an actorId (the id already stored on inventory movements, cash
 * sessions, and cash movements) to "Nombre Apellido" for display, instead
 * of the raw user id. Includes inactive users too — an old movement should
 * still show who made it. Falls back to the raw id whenever it can't
 * resolve: the viewer lacks `users.read` (a real permission boundary, not
 * an error to surface), the directory hasn't loaded yet, or the id simply
 * isn't in it — display only, so degrading to the id is always safe.
 */
export function useActorNames(): (
  actorId: string | null | undefined,
) => string {
  const { hasPermission } = useAuth();
  const enabled = hasPermission("users.read");
  const users = useQuery({
    queryKey: queryKeys.users(ACTOR_NAMES_PARAMS),
    queryFn: () => usersApi.list(ACTOR_NAMES_PARAMS),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
  const byId = useMemo(
    () =>
      new Map(
        (users.data?.data ?? []).map((user) => [
          user.id,
          `${user.firstName} ${user.lastName}`.trim(),
        ]),
      ),
    [users.data],
  );
  return (actorId) => {
    if (!actorId) return "";
    return byId.get(actorId) ?? actorId;
  };
}
