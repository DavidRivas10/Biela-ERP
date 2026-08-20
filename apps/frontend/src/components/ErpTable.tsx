import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";

export interface ErpColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
}

export function ErpTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  emptyTitle = "Sin resultados",
  emptyDescription = "No hay registros que coincidan con los filtros actuales.",
}: {
  columns: ErpColumn<T>[];
  rows?: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (loading) return <LoadingState label="Cargando registros…" />;
  if (error)
    return (
      <ErrorState
        title="No fue posible cargar los datos"
        message={error}
        onRetry={onRetry}
      />
    );
  if (!rows?.length)
    return <EmptyState title={emptyTitle}>{emptyDescription}</EmptyState>;
  return (
    <div className="table-scroll" tabIndex={0} aria-label="Tabla desplazable">
      <table className="erp-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key}>{column.cell(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
