import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { purchasingFinanceApi } from "../api/purchasing-finance-api";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { CommercialStatusBadge } from "../components/CommercialStatusBadge";
import { ErpTable, type ErpColumn } from "../components/ErpTable";
import { Field } from "../components/Field";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { SupplierSelector } from "../components/PurchasingSelectors";
import { useUrlFilters } from "../hooks/use-url-filters";
import { queryKeys } from "../query/query-keys";
import type { PayableDocument, SettlementStatus } from "../types/purchasing";
import { apiErrorMessage } from "../utils/api-error";
import { formatCalendarDate, formatMoney } from "../utils/formatters";

export function PayablesPage() {
  const filters = useUrlFilters();
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
  const columns: ErpColumn<PayableDocument>[] = [
    {
      key: "purchase",
      header: "Compra",
      cell: (row) => (
        <Link className="table-link" to={`/app/purchasing/purchases/${row.id}`}>
          <strong>#{row.number}</strong>
          <small>{formatCalendarDate(row.documentDate)}</small>
        </Link>
      ),
    },
    {
      key: "supplier",
      header: "Proveedor",
      cell: (row) => (
        <Link
          className="table-link"
          to={`/app/purchasing/suppliers/${row.supplierId}`}
        >
          <strong>{row.supplier.code}</strong>
          <small>{row.supplier.businessName}</small>
        </Link>
      ),
    },
    {
      key: "net",
      header: "Obligación neta",
      cell: (row) => formatMoney(row.netPurchaseObligation),
    },
    {
      key: "paid",
      header: "Pagado neto",
      cell: (row) => formatMoney(row.netPaidAmount),
    },
    {
      key: "outstanding",
      header: "Pendiente",
      cell: (row) => <strong>{formatMoney(row.outstandingAmount)}</strong>,
    },
    {
      key: "credit",
      header: "Crédito proveedor",
      cell: (row) => formatMoney(row.supplierCreditAmount),
    },
    {
      key: "due",
      header: "Vencimiento",
      cell: (row) => (
        <>
          <span>
            {row.paymentDueDate ? formatCalendarDate(row.paymentDueDate) : "—"}
          </span>
          {row.overdue ? (
            <Badge tone="danger">Vencida · {row.ageInDays} días</Badge>
          ) : null}
        </>
      ),
    },
    {
      key: "settlement",
      header: "Liquidación",
      cell: (row) => <CommercialStatusBadge status={row.settlementStatus} />,
    },
  ];
  const summary = list.data?.summary;
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Comercial"
        title="Cuentas por pagar"
        description="Obligaciones y créditos operacionales derivados; no es contabilidad."
      />
      {summary ? (
        <section className="commercial-summary-grid panel">
          <span>
            Documentos <strong>{summary.documentCount}</strong>
          </span>
          <span>
            Compra bruta <strong>{formatMoney(summary.grossAmount)}</strong>
          </span>
          <span>
            Devoluciones <strong>{formatMoney(summary.returnAmount)}</strong>
          </span>
          <span>
            Obligación neta <strong>{formatMoney(summary.netAmount)}</strong>
          </span>
          <span>
            Pagado <strong>{formatMoney(summary.paidAmount)}</strong>
          </span>
          <span>
            Reembolsado <strong>{formatMoney(summary.refundedAmount)}</strong>
          </span>
          <span>
            Pendiente <strong>{formatMoney(summary.outstandingAmount)}</strong>
          </span>
          <span>
            Crédito proveedor{" "}
            <strong>{formatMoney(summary.creditAmount)}</strong>
          </span>
          <span>
            Vencido <strong>{formatMoney(summary.overdueAmount)}</strong>
          </span>
          <span>
            Sin pagar <strong>{summary.unpaidCount}</strong>
          </span>
          <span>
            Pago parcial <strong>{summary.partiallyPaidCount}</strong>
          </span>
          <span>
            Pagadas <strong>{summary.paidCount}</strong>
          </span>
        </section>
      ) : null}
      <section className="panel filter-bar">
        <SupplierSelector
          id="payables-supplier"
          label="Proveedor"
          value={filters.values.supplierId ?? ""}
          emptyLabel="Todos"
          onChange={(supplierId) => filters.update({ supplierId })}
        />
        <Field label="Liquidación" htmlFor="payables-status">
          <select
            id="payables-status"
            value={filters.values.settlementStatus ?? ""}
            onChange={(e) =>
              filters.update({ settlementStatus: e.target.value })
            }
          >
            <option value="">Pendientes o con crédito</option>
            {(["UNPAID", "PARTIALLY_PAID", "PAID"] as SettlementStatus[]).map(
              (status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ),
            )}
          </select>
        </Field>
        <Field label="Vencimiento" htmlFor="payables-overdue">
          <select
            id="payables-overdue"
            value={filters.values.overdueOnly ?? ""}
            onChange={(e) => filters.update({ overdueOnly: e.target.value })}
          >
            <option value="">Todos</option>
            <option value="true">Solo vencidos</option>
            <option value="false">No vencidos</option>
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
        <Field label="Documento desde" htmlFor="payables-doc-from">
          <input
            id="payables-doc-from"
            type="date"
            value={filters.values.documentFrom ?? ""}
            onChange={(e) => filters.update({ documentFrom: e.target.value })}
          />
        </Field>
        <Field label="Documento hasta" htmlFor="payables-doc-to">
          <input
            id="payables-doc-to"
            type="date"
            value={filters.values.documentTo ?? ""}
            onChange={(e) => filters.update({ documentTo: e.target.value })}
          />
        </Field>
        <div className="filter-actions">
          <Button variant="ghost" onClick={filters.clear}>
            Limpiar
          </Button>
        </div>
      </section>
      <section className="panel">
        <ErpTable
          columns={columns}
          rows={list.data?.data}
          rowKey={(row) => row.id}
          loading={list.isLoading}
          error={list.error ? apiErrorMessage(list.error) : undefined}
          onRetry={() => void list.refetch()}
          emptyTitle="Sin cuentas por pagar para estos filtros"
        />
        <Pagination
          meta={list.data?.meta}
          onPageChange={(page) => filters.update({ page }, false)}
        />
      </section>
    </div>
  );
}
