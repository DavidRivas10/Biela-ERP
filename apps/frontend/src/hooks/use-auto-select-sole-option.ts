import { useEffect } from "react";

/**
 * When a lookup has exactly one active result and nothing is chosen yet,
 * pick it automatically instead of making the operator choose from a list of
 * one — e.g. the shop's only warehouse location, or its only active
 * supplier. Skipped while there's an active search term (the operator is
 * looking for something specific) or a value is already set, so it never
 * fights a deliberate choice.
 */
export function useAutoSelectSoleOption<T>(options: {
  value: string;
  searchTerm: string;
  loading: boolean;
  total: number | undefined;
  rows: T[];
  onSelect: (row: T) => void;
}) {
  const { value, searchTerm, loading, total, rows, onSelect } = options;
  useEffect(() => {
    if (value || searchTerm || loading) return;
    if (total === 1 && rows.length === 1) onSelect(rows[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, searchTerm, loading, total, rows]);
}
