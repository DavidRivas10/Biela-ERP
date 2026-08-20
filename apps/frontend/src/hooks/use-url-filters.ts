import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export function useUrlFilters(defaultLimit = 20) {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(params.get("limit")) || defaultLimit),
  );
  const values = useMemo(() => Object.fromEntries(params.entries()), [params]);

  const update = useCallback(
    (
      changes: Record<string, string | number | boolean | undefined>,
      resetPage = true,
    ) => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        Object.entries(changes).forEach(([key, value]) => {
          if (value === undefined || value === "") next.delete(key);
          else next.set(key, String(value));
        });
        if (resetPage && !("page" in changes)) next.delete("page");
        return next;
      });
    },
    [setParams],
  );

  const clear = useCallback(
    () => setParams(new URLSearchParams()),
    [setParams],
  );
  return { params, values, page, limit, update, clear };
}
