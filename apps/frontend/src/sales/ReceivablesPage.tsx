import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { salesFinanceApi } from "../api/sales-finance-api";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { ErpTable, type ErpColumn } from "../components/ErpTable";
import { Field } from "../components/Field";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { CustomerSelector } from "../components/SalesSelectors";
import { useUrlFilters } from "../hooks/use-url-filters";
import { queryKeys } from "../query/query-keys";
import type { ReceivableDocument } from "../types/sales";
import { apiErrorMessage } from "../utils/api-error";
import { formatCalendarDate, formatMoney, pluralize } from "../utils/formatters";

const SETTLEMENT_LABELS: Record<string, string> = {
  UNPAID: "Sin pagar",
  PARTIALLY_PAID: "Pago parcial",
  PAID: "Pagada",
};

function DueCell({ row }: { row: ReceivableDocument }) {
  if (!row.paymentDueDate) return <span className="muted">Sin fecha</span>;
  return (
    <>
      <span>{formatCalendarDate(row.paymentDueDate)}</span>
      {row.overdue ? (
        <Badge tone="danger">
          Vencida hace {pluralize(row.ageInDays, "día", "días")}
        </Badge>
      ) : null}
    </>
  );
}

export function ReceivablesPage() {
  const { hasPermission } = useAuth();
  const filters = useUrlFilters();
  const canCollect = hasPermission("payments.create");
  const params = {
    page: filters.page,
    limit: filters.limit,
    customerId: filters.values.customerId,
    settlementStatus: filters.values.settlementStatus,
    overdueOnly: filters.values.overdueOnly,
    dueFrom: filters.values.dueFrom,
    dueTo: filters.values.dueTo,
    documentFrom: filters.values.documentFrom,
    documentTo: filters.values.documentTo,
  };
  const list = useQuery({
    queryKey: queryKeys.receivables(params),
    queryFn: () => salesFinanceApi.receivables(params),
  });
  const hasActiveFilters = Boolean(
    filters.values.customerId ||
      filters.values.settlementStatus ||
      filters.values.overdueOnly ||
      filters.values.dueFrom ||
      filters.values.dueTo ||
      filters.values.documentFrom ||
      filters.values.documentTo,
  );

  const columns: ErpColumn<ReceivableDocument>[] = [
    {
      key: "customer",
      header: "Cliente",
      cell: (row) =>
        row.walkIn ? (
          <>
            <strong>Mostrador</strong>
            <small>Sin cliente registrado</small>
          </>
        ) : (
          <>
            <strong>{row.customer?.name}</strong>
            <small>{row.customer?.code}</small>
          </>
        ),
    },
    {
      key: "document",
      header: "Venta",
      cell: (row) => (
        <Link className="table-link" to={`/app/sales/${row.id}`}>
          <strong>#{row.number}</strong>
          <small>{formatCalendarDate(row.documentDate)}</small>
        </Link>
      ),
    },
    {
      key: "outstanding",
      header: "Te debe",
      cell: (row) => (
        <>
          <strong>{formatMoney(row.outstandingAmount)}</strong>
          <small>de {formatMoney(row.total)}</small>
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
        canCollect ? (
          <Link
            className="button button--primary"
            to={`/app/sales/${row.id}/payments`}
          >
            Cobrar
          </Link>
        ) : (
          <Link className="button button--ghost" to={`/app/sales/${row.id}`}>
            Ver venta
          </Link>
        ),
    },
  ];

  const summary = list.data?.summary;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Dinero"
        title="Cuentas por cobrar"
        description="Lo que tus clientes te deben: ventas confirmadas que todavía no te pagaron por completo. «Te debe» es el total de la venta menos lo que ya pagó. Una venta está «vencida» cuando pasó su fecha de pago y sigue debiendo."
      />

      {summary ? (
        <>
          <div className="metrics-grid">
            <article className="metric-card">
              <span>Te deben en total</span>
              <strong>{formatMoney(summary.outstandingAmount)}</strong>
            </article>
            <article className="metric-card">
              <span>Vencido</span>
              <strong>{formatMoney(summary.overdueAmount)}</strong>
              <small>
                {pluralize(
                  summary.overdueCount,
                  "venta atrasada",
                  "ventas atrasadas",
                )}
              </small>
            </article>
            <article className="metric-card">
              <span>Ventas con saldo</span>
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
          <CustomerSelector
            id="receivables-customer"
            label="Cliente"
            value={filters.values.customerId ?? ""}
            emptyLabel="Cualquiera (incluido mostrador)"
            onChange={(customerId) => filters.update({ customerId })}
          />
          <Field label="Estado del pago" htmlFor="receivable-status">
            <select
              id="receivable-status"
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
          <Field label="Mostrar" htmlFor="receivable-overdue">
            <select
              id="receivable-overdue"
              value={filters.values.overdueOnly ?? ""}
              onChange={(e) => filters.update({ overdueOnly: e.target.value })}
            >
              <option value="">Todas</option>
              <option value="true">Solo vencidas</option>
              <option value="false">Solo al día</option>
            </select>
          </Field>
          <Field label="Vence desde" htmlFor="receivable-due-from">
            <input
              id="receivable-due-from"
              type="date"
              value={filters.values.dueFrom ?? ""}
              onChange={(e) => filters.update({ dueFrom: e.target.value })}
            />
          </Field>
          <Field label="Vence hasta" htmlFor="receivable-due-to">
            <input
              id="receivable-due-to"
              type="date"
              value={filters.values.dueTo ?? ""}
              onChange={(e) => filters.update({ dueTo: e.target.value })}
            />
          </Field>
          <Field label="Venta desde" htmlFor="receivable-doc-from">
            <input
              id="receivable-doc-from"
              type="date"
              value={filters.values.documentFrom ?? ""}
              onChange={(e) => filters.update({ documentFrom: e.target.value })}
            />
          </Field>
          <Field label="Venta hasta" htmlFor="receivable-doc-to">
            <input
              id="receivable-doc-to"
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
                title="Ninguna venta coincide"
                action={
                  <Button type="button" onClick={filters.clear}>
                    Quitar los filtros
                  </Button>
                }
              >
                No hay ventas por cobrar con el cliente, el estado o las fechas
                que filtraste.
              </EmptyState>
            ) : (
              <EmptyState title="No te deben nada">
                Todas las ventas confirmadas están pagadas por completo.
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
