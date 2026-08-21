import type { PaginationMeta } from "../types/erp";
import { Button } from "./Button";

export function Pagination({
  meta,
  onPageChange,
  ariaLabel = "Paginación",
}: {
  meta?: PaginationMeta;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
}) {
  if (!meta || meta.total === 0) return null;
  return (
    <nav className="pagination" aria-label={ariaLabel}>
      <p>
        Página <strong>{meta.page}</strong> de{" "}
        <strong>{Math.max(meta.pages, 1)}</strong> · {meta.total} registros
      </p>
      <div>
        <Button
          type="button"
          variant="secondary"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
        >
          Anterior
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={meta.page >= meta.pages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </nav>
  );
}
