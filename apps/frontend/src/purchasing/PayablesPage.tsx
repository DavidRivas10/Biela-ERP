import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { purchasingFinanceApi } from "../api/purchasing-finance-api";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { ErpTable, type ErpColumn } from "../components/ErpTable";
import { Field } from "../components/Field";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { SupplierSelector } from "../components/PurchasingSelectors";
import { useUrlFilters } from "../hooks/use-url-filters";
import { queryKeys } from "../query/query-keys";
import type { PayableDocument } from "../types/purchasing";
import { apiErrorMessage } from "../utils/api-error";
import { formatCalendarDate, formatMoney } from "../utils/formatters";

const SETTLEMENT_LABELS: Record<string, string> = {
  UNPAID: "Sin pagar",
  PARTIALLY_PAID: "Pago parcial",
  PAID: "Pagada",
};

function DueCell({ row }: { row: PayableDocument }) {
  if (!row.paymentDueDate) return <span className="muted">Sin fecha</span>;
  return (
    <>
      <span>{formatCalendarDate(row.paymentDueDate)}</span>
      {row.overdue ? (
        <Badge tone="danger">
          Vencida hace {row.ageInDays}{" "}
          {row.ageInDays === 1 ? "día" : "días"}
        </Badge>
      ) : null}
    </>
  );
}

export function PayablesPage() {
  const { hasPermission } = useAuth();
  const filters = useUrlFilters();
  const canPay = hasPermission("purchases.pay");
  const params = {
    page: filters.page,
    limit: filters.limit,
    supplierId: filters.values.supplierId,
    settlementStatus: filters.values.settlementStatus,
    overdueOnly: filters.values.overdueOnly,
    dueFrom: filters.values.dueFrom,
    dueTo: filters.values.dueTo,
    documentFrom: filters.values.documentFrom,
    documentTo: filters.values.documentTo,
  };
  const list = useQuery({
    queryKey: queryKeys.payables(params),
    queryFn: () => purchasingFinanceApi.payables(params),
  });
  const hasActiveFilters = Boolean(
    filters.values.supplierId ||
      filters.values.settlementStatus ||
      filters.values.overdueOnly ||
      filters.values.dueFrom ||
      filters.values.dueTo ||
      filters.values.documentFrom ||
      filters.values.documentTo,
  );

  const columns: ErpColumn<PayableDocument>[] = [
    {
      key: "supplier",
      header: "Proveedor",
      cell: (row) => (
        <Link
          className="table-link"
          to={`/app/purchasing/suppliers/${row.supplierId}`}
        >
          <strong>{row.supplier.businessName}</strong>
          <small>{row.supplier.code}</small>
        </Link>
      ),
    },
    {
      key: "document",
      header: "Compra",
      cell: (row) => (
        <Link
          className="table-link"
          to={`/app/purchasing/purchases/${row.id}`}
        >
          <strong>#{row.number}</strong>
          <small>{formatCalendarDate(row.documentDate)}</small>
        </Link>
      ),
    },
    {
      key: "outstanding",
      header: "Le debés",
      cell: (row) => (
        <>
          <strong>{formatMoney(row.outstandingAmount)}</strong>
          <small>de {formatMoney(row.netPurchaseObligation)}</small>
        </>
      ),
    },
    {
      key: "due",
      header: "Vence el pago",
      cell: (row) => <DueCell row={row} />,
    },
    {
      key: "status",
      header: "Estado del pago",
      cell: (row) => (
        <Badge
          tone={row.settlementStatus === "PARTIALLY_PAID" ? "warning" : "danger"}
        >
          {SETTLEMENT_LABELS[row.settlementStatus] ?? row.settlementStatus}
        </Badge>
      ),
    },
    {
      key: "action",
      header: "",
      cell: (row) =>
        canPay ? (
          <Link
            className="button button--primary"
            to={`/app/purchasing/purchases/${row.id}/payments`}
          >
            Pagar
          </Link>
        ) : (
          <Link
            className="button button--ghost"
            to={`/app/purchasing/purchases/${row.id}`}
          >
            Ver compra
          </Link>
        ),
    },
  ];

  const summary = list.data?.summary;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Dinero"
        title="Cuentas por pagar"
        description="Lo que le debés a tus proveedores: compras confirmadas que todavía no pagaste por completo. «Le debés» es el valor de la compra (menos devoluciones) menos lo que ya le pagaste. Una compra está «vencida» cuando pasó su fecha de pago y sigue debiendo."
      />

      {summary ? (
        <>
          <div className="metrics-grid">
            <article className="metric-card">
              <span>Debés en total</span>
              <strong>{formatMoney(summary.outstandingAmount)}</strong>
            </article>
            <article className="metric-card">
              <span>Vencido</span>
              <strong>{formatMoney(summary.overdueAmount)}</strong>
              <small>
                {summary.overdueCount} compra{summary.overdueCount === 1 ? "" : "s"} atrasada{summary.overdueCount === 1 ? "" : "s"}
              </small>
            </article>
            <article className="metric-card">
              <span>Compras con saldo</span>
              <strong>{summary.documentCount}</strong>
            </article>
          </div>
          {list.data?.businessDate ? (
            <p className="data-note">
              Datos al {formatCalendarDate(list.data.businessDate)}.
            </p>
          ) : null}
        </>
      ) : null}

      <details className="filter-details" open={hasActiveFilters}>
        <summary>Buscar o filtrar</summary>
        <div className="filter-bar">
          <SupplierSelector
            id="payables-supplier"
            label="Proveedor"
            value={filters.values.supplierId ?? ""}
            emptyLabel="Cualquiera"
            onChange={(supplierId) => filters.update({ supplierId })}
          />
          <Field label="Estado del pago" htmlFor="payables-status">
            <select
              id="payables-status"
              value={filters.values.settlementStatus ?? ""}
              onChange={(e) =>
                filters.update({ settlementStatus: e.target.value })
              }
            >
              <option value="">Con saldo pendiente</option>
              <option value="UNPAID">Sin pagar</option>
              <option value="PARTIALLY_PAID">Pago parcial</option>
              <option value="PAID">Pagadas</option>
            </select>
          </Field>
          <Field label="Mostrar" htmlFor="payables-overdue">
            <select
              id="payables-overdue"
              value={filters.values.overdueOnly ?? ""}
              onChange={(e) => filters.update({ overdueOnly: e.target.value })}
            >
              <option value="">Todas</option>
              <option value="true">Solo vencidas</option>
              <option value="false">Solo al día</option>
            </select>
          </Field>
          <Field label="Vence desde" htmlFor="payables-due-from">
            <input
              id="payables-due-from"
              type="date"
              value={filters.values.dueFrom ?? ""}
              onChange={(e) => filters.update({ dueFrom: e.target.value })}
            />
          </Field>
          <Field label="Vence hasta" htmlFor="payables-due-to">
            <input
              id="payables-due-to"
              type="date"
              value={filters.values.dueTo ?? ""}
              onChange={(e) => filters.update({ dueTo: e.target.value })}
            />
          </Field>
          <Field label="Compra desde" htmlFor="payables-doc-from">
            <input
              id="payables-doc-from"
              type="date"
              value={filters.values.documentFrom ?? ""}
              onChange={(e) => filters.update({ documentFrom: e.target.value })}
            />
          </Field>
          <Field label="Compra hasta" htmlFor="payables-doc-to">
            <input
              id="payables-doc-to"
              type="date"
              value={filters.values.documentTo ?? ""}
              onChange={(e) => filters.update({ documentTo: e.target.value })}
            />
          </Field>
          {hasActiveFilters ? (
            <div className="filter-actions">
              <Button variant="ghost" onClick={filters.clear}>
                Limpiar filtros
              </Button>
            </div>
          ) : null}
        </div>
      </details>

      <section className="panel">
        <ErpTable
          columns={columns}
          rows={list.data?.data}
          rowKey={(row) => row.id}
          loading={list.isLoading}
          error={list.error ? apiErrorMessage(list.error) : undefined}
          onRetry={() => void list.refetch()}
          rowClassName={(row) => (row.overdue ? "erp-row--overdue" : undefined)}
          emptyState={
            hasActiveFilters ? (
              <EmptyState
                tone="search"
                title="Ninguna compra coincide"
                action={
                  <Button type="button" onClick={filters.clear}>
                    Quitar los filtros
                  </Button>
                }
              >
                No hay compras por pagar con el proveedor, el estado o las
                fechas que filtraste.
              </EmptyState>
            ) : (
              <EmptyState title="No debés nada a proveedores">
                Todas las compras confirmadas están pagadas por completo.
              </EmptyState>
            )
          }
        />
        <Pagination
          meta={list.data?.meta}
          onPageChange={(page) => filters.update({ page }, false)}
        />
      </section>
    </div>
  );
}
