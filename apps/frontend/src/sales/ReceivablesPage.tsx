import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { salesFinanceApi } from "../api/sales-finance-api";
import { CommercialStatusBadge } from "../components/CommercialStatusBadge";
import { CustomerSelector } from "../components/SalesSelectors";
import { Button } from "../components/Button";
import { ErpTable, type ErpColumn } from "../components/ErpTable";
import { Field } from "../components/Field";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { useUrlFilters } from "../hooks/use-url-filters";
import { queryKeys } from "../query/query-keys";
import type { ReceivableDocument } from "../types/sales";
import { apiErrorMessage } from "../utils/api-error";
import { formatCalendarDate, formatMoney } from "../utils/formatters";

export function ReceivablesPage() {
  const filters = useUrlFilters();
  const params = { page: filters.page, limit: filters.limit, customerId: filters.values.customerId, settlementStatus: filters.values.settlementStatus, overdueOnly: filters.values.overdueOnly, dueFrom: filters.values.dueFrom, dueTo: filters.values.dueTo, documentFrom: filters.values.documentFrom, documentTo: filters.values.documentTo };
  const list = useQuery({ queryKey: queryKeys.receivables(params), queryFn: () => salesFinanceApi.receivables(params) });
  const columns: ErpColumn<ReceivableDocument>[] = [
    { key: "sale", header: "Venta", cell: (row) => <Link className="table-link" to={`/app/sales/${row.id}`}>#{row.number}</Link> },
    { key: "customer", header: "Cliente", cell: (row) => row.walkIn ? "Venta de mostrador" : `${row.customer?.code} · ${row.customer?.name}` },
    { key: "date", header: "Documento", cell: (row) => formatCalendarDate(row.documentDate) },
    { key: "due", header: "Vence", cell: (row) => row.paymentDueDate ? <><span>{formatCalendarDate(row.paymentDueDate)}</span>{row.overdue && <small>{row.ageInDays} días vencida</small>}</> : "—" },
    { key: "total", header: "Total", cell: (row) => formatMoney(row.total) },
    { key: "paid", header: "Pagado", cell: (row) => formatMoney(row.paidAmount) },
    { key: "outstanding", header: "Pendiente", cell: (row) => formatMoney(row.outstandingAmount) },
    { key: "status", header: "Estado", cell: (row) => <CommercialStatusBadge status={row.settlementStatus} /> },
  ];
  return <div className="page-stack"><PageHeader eyebrow="Comercial" title="Cuentas por cobrar" description="Vista operativa derivada por el backend; incluye ventas registradas y de mostrador." />
    {list.data && <section className="metric-grid"><article className="metric-card"><span>Pendiente</span><strong>{formatMoney(list.data.summary.outstandingAmount)}</strong></article><article className="metric-card"><span>Vencido</span><strong>{formatMoney(list.data.summary.overdueAmount)}</strong><small>{list.data.summary.overdueCount} documentos</small></article><article className="metric-card"><span>Fecha operativa</span><strong>{formatCalendarDate(list.data.businessDate)}</strong></article></section>}
    <section className="panel filter-bar"><CustomerSelector id="receivables-customer" label="Cliente" value={filters.values.customerId ?? ""} emptyLabel="Todos, incluido mostrador" onChange={(customerId) => filters.update({ customerId })} /><Field label="Liquidación" htmlFor="receivable-status"><select id="receivable-status" value={filters.values.settlementStatus ?? ""} onChange={(e) => filters.update({ settlementStatus: e.target.value })}><option value="">Pendientes</option><option value="UNPAID">UNPAID</option><option value="PARTIALLY_PAID">PARTIALLY_PAID</option><option value="PAID">PAID</option></select></Field><Field label="Vencimiento" htmlFor="receivable-overdue"><select id="receivable-overdue" value={filters.values.overdueOnly ?? ""} onChange={(e) => filters.update({ overdueOnly: e.target.value })}><option value="">Todos</option><option value="true">Solo vencidos</option><option value="false">No vencidos</option></select></Field><Field label="Vence desde" htmlFor="receivable-due-from"><input id="receivable-due-from" type="date" value={filters.values.dueFrom ?? ""} onChange={(e) => filters.update({ dueFrom: e.target.value })} /></Field><Field label="Vence hasta" htmlFor="receivable-due-to"><input id="receivable-due-to" type="date" value={filters.values.dueTo ?? ""} onChange={(e) => filters.update({ dueTo: e.target.value })} /></Field><Field label="Documento desde" htmlFor="receivable-doc-from"><input id="receivable-doc-from" type="date" value={filters.values.documentFrom ?? ""} onChange={(e) => filters.update({ documentFrom: e.target.value })} /></Field><Field label="Documento hasta" htmlFor="receivable-doc-to"><input id="receivable-doc-to" type="date" value={filters.values.documentTo ?? ""} onChange={(e) => filters.update({ documentTo: e.target.value })} /></Field><div className="filter-actions"><Button variant="ghost" onClick={filters.clear}>Limpiar</Button></div></section>
    <section className="panel"><ErpTable columns={columns} rows={list.data?.data} rowKey={(row) => row.id} loading={list.isLoading} error={list.error ? apiErrorMessage(list.error) : undefined} onRetry={() => void list.refetch()} emptyTitle="No hay cuentas por cobrar con estos filtros" /><Pagination meta={list.data?.meta} onPageChange={(page) => filters.update({ page }, false)} /></section>
  </div>;
}
