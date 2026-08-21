import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { salesApi, type SaleInput } from "../api/sales-api";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { CommercialStatusBadge } from "../components/CommercialStatusBadge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ErpTable, type ErpColumn } from "../components/ErpTable";
import { LocationSelector, ProductSelector } from "../components/EntitySelectors";
import { Field } from "../components/Field";
import { FormFeedback } from "../components/FormFeedback";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { CustomerSelector } from "../components/SalesSelectors";
import { useUrlFilters } from "../hooks/use-url-filters";
import { queryKeys } from "../query/query-keys";
import {
  invalidateCommercialSummary,
  invalidateInventoryIntegration,
} from "../query/invalidation";
import type { Product } from "../types/erp";
import type { Sale, SaleReturn, SaleStatus } from "../types/sales";
import { apiErrorMessage } from "../utils/api-error";
import { formatCalendarDate, formatDateTime, formatMoney } from "../utils/formatters";

const statuses: SaleStatus[] = ["DRAFT", "POSTED", "CANCELLED"];

export function SalesPage() {
  const { hasPermission } = useAuth();
  const filters = useUrlFilters();
  const params = { page: filters.page, limit: filters.limit, customerId: filters.values.customerId, productId: filters.values.productId, status: filters.values.status, number: filters.values.number, from: filters.values.from, to: filters.values.to };
  const list = useQuery({ queryKey: queryKeys.sales(params), queryFn: () => salesApi.list(params) });
  const columns: ErpColumn<Sale>[] = [
    { key: "number", header: "Venta", cell: (row) => <Link className="table-link" to={`/app/sales/${row.id}`}><strong>#{row.number}</strong><small>{row._count?.items ?? 0} líneas</small></Link> },
    { key: "customer", header: "Cliente", cell: (row) => row.customer ? <><strong>{row.customer.code}</strong><small>{row.customer.name}</small></> : "Venta de mostrador" },
    { key: "date", header: "Fecha", cell: (row) => formatCalendarDate(row.documentDate) },
    { key: "due", header: "Vence", cell: (row) => row.paymentDueDate ? formatCalendarDate(row.paymentDueDate) : "—" },
    { key: "total", header: "Total", cell: (row) => formatMoney(row.total) },
    { key: "status", header: "Estado", cell: (row) => <CommercialStatusBadge status={row.status} /> },
  ];
  return <div className="page-stack"><PageHeader eyebrow="Ventas" title="Ventas" description="Ventas registradas y de mostrador con ciclo explícito DRAFT → POSTED." actions={hasPermission("sales.create") ? <Link className="button button--primary" to="/app/sales/new">Nueva venta</Link> : undefined} />
    <section className="panel filter-bar">
      <CustomerSelector id="sales-customer-filter" label="Cliente" value={filters.values.customerId ?? ""} emptyLabel="Todos" onChange={(customerId) => filters.update({ customerId })} />
      <ProductSelector id="sales-product-filter" label="Producto" value={filters.values.productId ?? ""} emptyLabel="Todos" onChange={(productId) => filters.update({ productId })} />
      <Field label="Estado" htmlFor="sale-status"><select id="sale-status" value={filters.values.status ?? ""} onChange={(e) => filters.update({ status: e.target.value })}><option value="">Todos</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select></Field>
      <Field label="Número" htmlFor="sale-number"><input id="sale-number" type="number" min={1} value={filters.values.number ?? ""} onChange={(e) => filters.update({ number: e.target.value })} /></Field>
      <Field label="Desde" htmlFor="sale-from"><input id="sale-from" type="date" value={filters.values.from ?? ""} onChange={(e) => filters.update({ from: e.target.value })} /></Field>
      <Field label="Hasta" htmlFor="sale-to"><input id="sale-to" type="date" value={filters.values.to ?? ""} onChange={(e) => filters.update({ to: e.target.value })} /></Field>
      <div className="filter-actions"><Button variant="ghost" onClick={filters.clear}>Limpiar</Button></div>
    </section><section className="panel"><ErpTable columns={columns} rows={list.data?.data} rowKey={(row) => row.id} loading={list.isLoading} error={list.error ? apiErrorMessage(list.error) : undefined} onRetry={() => void list.refetch()} emptyTitle="No se encontraron ventas" /><Pagination meta={list.data?.meta} onPageChange={(page) => filters.update({ page }, false)} /></section>
  </div>;
}

type Line = { key: number; productId: string; sourceLocationId: string; quantity: string; unitPrice: string; discountAmount: string; taxAmount: string };
const newLine = (key: number): Line => ({ key, productId: "", sourceLocationId: "", quantity: "1", unitPrice: "", discountAmount: "0.00", taxAmount: "0.00" });

export function SaleFormPage() {
  const { id } = useParams();
  const detail = useQuery({ queryKey: queryKeys.sale(id ?? "new"), queryFn: () => salesApi.detail(id!), enabled: Boolean(id) });
  if (id && detail.isLoading) return <div className="panel">Cargando venta…</div>;
  if (id && detail.error) return <FormFeedback error={apiErrorMessage(detail.error)} />;
  if (id && detail.data?.status !== "DRAFT") return <FormFeedback error="Solo las ventas DRAFT pueden editarse." />;
  return <SaleEditor id={id} initial={detail.data} />;
}

function SaleEditor({ id, initial }: { id?: string; initial?: Sale }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [documentDate, setDocumentDate] = useState(initial?.documentDate.slice(0, 10) ?? "");
  const [paymentDueDate, setPaymentDueDate] = useState(initial?.paymentDueDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(() => initial ? (initial.items ?? []).map((item, index) => ({ key: index + 1, productId: item.productId, sourceLocationId: item.sourceLocationId, quantity: String(item.quantity), unitPrice: item.unitPrice, discountAmount: item.discountAmount, taxAmount: item.taxAmount })) : [newLine(1)]);
  const [formError, setFormError] = useState<string | null>(null);
  const duplicate = useMemo(() => { const keys = lines.filter((line) => line.productId && line.sourceLocationId).map((line) => `${line.productId}:${line.sourceLocationId}`); return new Set(keys).size !== keys.length; }, [lines]);
  const mutation = useMutation({ mutationFn: (body: SaleInput) => id ? salesApi.update(id, body) : salesApi.create(body), onSuccess: async (sale) => { client.setQueryData(queryKeys.sale(sale.id), sale); await client.invalidateQueries({ queryKey: queryKeys.salesRoot }); void navigate(`/app/sales/${sale.id}`, { replace: true }); } });
  const updateLine = (key: number, changes: Partial<Line>) => setLines((current) => current.map((line) => line.key === key ? { ...line, ...changes } : line));
  function submit(event: FormEvent) {
    event.preventDefault();
    if (duplicate) { setFormError("Una combinación de producto y ubicación solo puede aparecer una vez."); return; }
    setFormError(null);
    mutation.mutate({ customerId: customerId || null, documentDate, paymentDueDate: paymentDueDate || undefined, notes: notes || undefined, items: lines.map((line) => ({ productId: line.productId, sourceLocationId: line.sourceLocationId, quantity: Number(line.quantity), unitPrice: line.unitPrice || undefined, discountAmount: line.discountAmount || undefined, taxAmount: line.taxAmount || undefined })) });
  }
  return <div className="page-stack"><PageHeader eyebrow="Ventas" title={id ? "Editar venta" : "Nueva venta"} description="Guardar conserva el borrador sin tocar inventario; el servidor calcula todos los importes exactos." />
    <form className="panel erp-form" onSubmit={submit}><FormFeedback error={formError ?? (mutation.error ? apiErrorMessage(mutation.error) : null)} /><div className="form-grid"><CustomerSelector id="sale-customer" label="Cliente" value={customerId} onChange={setCustomerId} /><Field label="Fecha del documento" htmlFor="sale-date" required><input id="sale-date" type="date" required value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} /></Field><Field label="Fecha de vencimiento" htmlFor="sale-due"><input id="sale-due" type="date" value={paymentDueDate} onChange={(e) => setPaymentDueDate(e.target.value)} /></Field><Field label="Notas" htmlFor="sale-notes"><textarea id="sale-notes" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div>
      <fieldset className="form-section purchase-lines"><legend>Productos</legend><p>El precio sugerido se toma del producto; el backend mantiene la verdad histórica en cada línea.</p>{lines.map((line, index) => <div className="purchase-line" key={line.key}>
        <ProductSelector id={`sale-product-${line.key}`} label={`Producto ${index + 1}`} required value={line.productId} onChange={(productId, item?: Product) => updateLine(line.key, { productId, unitPrice: item?.defaultSalePrice ?? line.unitPrice })} />
        <LocationSelector id={`sale-location-${line.key}`} label="Ubicación origen" required value={line.sourceLocationId} onChange={(sourceLocationId) => updateLine(line.key, { sourceLocationId })} />
        <Field label="Cantidad" htmlFor={`sale-qty-${line.key}`} required><input id={`sale-qty-${line.key}`} required type="number" min={1} step={1} value={line.quantity} onChange={(e) => updateLine(line.key, { quantity: e.target.value })} /></Field>
        <Field label="Precio unitario" htmlFor={`sale-price-${line.key}`} required><input id={`sale-price-${line.key}`} required inputMode="decimal" pattern="\d+(\.\d{1,4})?" value={line.unitPrice} onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })} /></Field>
        <Field label="Descuento" htmlFor={`sale-discount-${line.key}`}><input id={`sale-discount-${line.key}`} inputMode="decimal" pattern="\d+(\.\d{1,2})?" value={line.discountAmount} onChange={(e) => updateLine(line.key, { discountAmount: e.target.value })} /></Field>
        <Field label="Impuesto" htmlFor={`sale-tax-${line.key}`}><input id={`sale-tax-${line.key}`} inputMode="decimal" pattern="\d+(\.\d{1,2})?" value={line.taxAmount} onChange={(e) => updateLine(line.key, { taxAmount: e.target.value })} /></Field>
        {lines.length > 1 && <Button type="button" variant="danger" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>Quitar</Button>}
      </div>)}<Button type="button" variant="secondary" onClick={() => setLines((current) => [...current, newLine(Math.max(...current.map((line) => line.key)) + 1)])}>Agregar producto</Button></fieldset>
      <div className="form-actions"><Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancelar</Button><Button type="submit" loading={mutation.isPending}>Guardar borrador</Button></div></form>
  </div>;
}

export function SaleDetailPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const [returnPage, setReturnPage] = useState(1);
  const [action, setAction] = useState<"post" | "cancel" | null>(null);
  const detail = useQuery({ queryKey: queryKeys.sale(id), queryFn: () => salesApi.detail(id) });
  const returnParams = { page: returnPage, limit: 20 };
  const returns = useQuery({ queryKey: queryKeys.saleReturns(id, returnParams), queryFn: () => salesApi.returns(id, returnParams), enabled: hasPermission("sales.read") });
  const mutation = useMutation({ mutationFn: () => action === "post" ? salesApi.post(id) : salesApi.cancel(id), onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: queryKeys.sale(id) }), client.invalidateQueries({ queryKey: queryKeys.salesRoot }), client.invalidateQueries({ queryKey: queryKeys.receivablesRoot }), client.invalidateQueries({ queryKey: queryKeys.customerAccountsRoot }), invalidateInventoryIntegration(client), invalidateCommercialSummary(client)]); setAction(null); } });
  if (detail.isLoading) return <div className="panel">Cargando venta…</div>;
  if (!detail.data || detail.error) return <FormFeedback error={apiErrorMessage(detail.error)} />;
  const sale = detail.data;
  const returnColumns: ErpColumn<SaleReturn>[] = [
    { key: "number", header: "Devolución", cell: (row) => <Link className="table-link" to={`/app/sales/returns/${row.id}`}>#{row.number}</Link> },
    { key: "reason", header: "Motivo", cell: (row) => row.reason },
    { key: "created", header: "Creada", cell: (row) => formatDateTime(row.createdAt) },
    { key: "status", header: "Estado", cell: (row) => <CommercialStatusBadge status={row.status} /> },
  ];
  return <div className="page-stack"><PageHeader eyebrow="Ventas" title={`Venta #${sale.number}`} description={sale.customer ? `${sale.customer.code} · ${sale.customer.name}` : "Venta de mostrador"} actions={<><CommercialStatusBadge status={sale.status} />{sale.status === "DRAFT" && hasPermission("sales.update") && <Link className="button button--secondary" to={`/app/sales/${id}/edit`}>Editar</Link>}{sale.status === "DRAFT" && hasPermission("sales.post") && <Button onClick={() => setAction("post")}>Postear</Button>}{sale.status === "DRAFT" && hasPermission("sales.update") && <Button variant="danger" onClick={() => setAction("cancel")}>Cancelar</Button>}{sale.status === "POSTED" && hasPermission("sales.return") && <Link className="button button--secondary" to={`/app/sales/${id}/returns`}>Nueva devolución</Link>}{sale.status === "POSTED" && (hasPermission("payments.read") || hasPermission("payments.create")) && <Link className="button button--secondary" to={`/app/sales/${id}/payments`}>Pagos</Link>}</>} />
    <section className="panel detail-grid"><div><span className="eyebrow">Fecha</span><p>{formatCalendarDate(sale.documentDate)}</p></div><div><span className="eyebrow">Vencimiento</span><p>{sale.paymentDueDate ? formatCalendarDate(sale.paymentDueDate) : "—"}</p></div><div><span className="eyebrow">Total</span><p>{formatMoney(sale.total)}</p></div><div><span className="eyebrow">Saldo pendiente</span><p>{sale.paymentSummary ? formatMoney(sale.paymentSummary.outstandingAmount) : "—"}</p></div></section>
    <section className="panel"><h2>Líneas</h2><div className="table-wrap"><table><thead><tr><th>Producto</th><th>Origen</th><th>Cantidad</th><th>Devuelta</th><th>Precio</th><th>Total</th></tr></thead><tbody>{sale.items?.map((item) => <tr key={item.id}><td>{item.product.code} · {item.product.name}</td><td>{item.sourceLocation.code}</td><td>{item.quantity}</td><td>{item.returnedQuantity}</td><td>{formatMoney(item.unitPrice)}</td><td>{formatMoney(item.lineTotal)}</td></tr>)}</tbody></table></div></section>
    <section className="panel"><h2>Devoluciones</h2><ErpTable columns={returnColumns} rows={returns.data?.data} rowKey={(row) => row.id} loading={returns.isLoading} error={returns.error ? apiErrorMessage(returns.error) : undefined} emptyTitle="Sin devoluciones" /><Pagination meta={returns.data?.meta} onPageChange={setReturnPage} /></section>
    {mutation.error && <FormFeedback error={apiErrorMessage(mutation.error)} />}
    <ConfirmDialog open={Boolean(action)} title={action === "post" ? "Postear venta" : "Cancelar venta"} description={action === "post" ? "Esta acción descontará inventario de forma atómica y no puede deshacerse desde la venta." : "Solo se cancela el borrador; no hay efectos de inventario."} confirmLabel={action === "post" ? "Postear venta" : "Cancelar venta"} dangerous={action === "cancel"} loading={mutation.isPending} onCancel={() => setAction(null)} onConfirm={() => mutation.mutate()} />
  </div>;
}
