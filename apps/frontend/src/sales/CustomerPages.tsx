import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { customersApi, type CustomerInput } from "../api/customers-api";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { CommercialStatusBadge } from "../components/CommercialStatusBadge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ErpTable, type ErpColumn } from "../components/ErpTable";
import { Field } from "../components/Field";
import { FormFeedback } from "../components/FormFeedback";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { StatusBadge } from "../components/StatusBadge";
import { useUrlFilters } from "../hooks/use-url-filters";
import { queryKeys } from "../query/query-keys";
import { invalidateCustomerReferenceIntegration } from "../query/invalidation";
import type { Customer, ReceivableDocument } from "../types/sales";
import { apiErrorMessage } from "../utils/api-error";
import { formatCalendarDate, formatMoney } from "../utils/formatters";

const empty: CustomerInput = { code: "", name: "", businessName: "", taxId: "", contactName: "", phone: "", email: "", address: "", notes: "", active: true };

export function CustomersPage() {
  const { hasPermission } = useAuth();
  const filters = useUrlFilters();
  const [search, setSearch] = useState(filters.values.search ?? "");
  const params = { page: filters.page, limit: filters.limit, search: filters.values.search, active: filters.values.active };
  const list = useQuery({ queryKey: queryKeys.customers(params), queryFn: () => customersApi.list(params) });
  const columns: ErpColumn<Customer>[] = [
    { key: "customer", header: "Cliente", cell: (row) => <Link className="table-link" to={`/app/sales/customers/${row.id}`}><strong>{row.code}</strong><small>{row.name}</small></Link> },
    { key: "business", header: "Razón social", cell: (row) => row.businessName || "—" },
    { key: "contact", header: "Contacto", cell: (row) => <><span>{row.contactName || "—"}</span><small>{row.email || row.phone || "Sin contacto"}</small></> },
    { key: "tax", header: "RTN / identificación", cell: (row) => row.taxId || "—" },
    { key: "active", header: "Estado", cell: (row) => <StatusBadge active={row.active} /> },
  ];
  return <div className="page-stack">
    <PageHeader eyebrow="Ventas" title="Clientes" description="Directorio de clientes; las ventas históricas permanecen aunque un cliente se desactive." actions={hasPermission("customers.create") ? <Link className="button button--primary" to="/app/sales/customers/new">Nuevo cliente</Link> : undefined} />
    <form className="panel filter-bar" onSubmit={(event) => { event.preventDefault(); filters.update({ search }); }}>
      <Field label="Buscar" htmlFor="customer-search"><input id="customer-search" placeholder="Código, nombre o razón social" value={search} onChange={(event) => setSearch(event.target.value)} /></Field>
      <Field label="Estado" htmlFor="customer-active"><select id="customer-active" value={filters.values.active ?? ""} onChange={(event) => filters.update({ active: event.target.value })}><option value="">Todos</option><option value="true">Activos</option><option value="false">Inactivos</option></select></Field>
      <div className="filter-actions"><Button type="submit">Aplicar</Button><Button type="button" variant="ghost" onClick={() => { setSearch(""); filters.clear(); }}>Limpiar</Button></div>
    </form>
    <section className="panel"><ErpTable columns={columns} rows={list.data?.data} rowKey={(row) => row.id} loading={list.isLoading} error={list.error ? apiErrorMessage(list.error) : undefined} onRetry={() => void list.refetch()} emptyTitle="No se encontraron clientes" /><Pagination meta={list.data?.meta} onPageChange={(page) => filters.update({ page }, false)} /></section>
  </div>;
}

export function CustomerFormPage() {
  const { id } = useParams();
  const detail = useQuery({ queryKey: queryKeys.customer(id ?? "new"), queryFn: () => customersApi.detail(id!), enabled: Boolean(id) });
  if (id && detail.isLoading) return <div className="panel">Cargando cliente…</div>;
  if (id && detail.error) return <FormFeedback error={apiErrorMessage(detail.error)} />;
  return <CustomerEditor id={id} initial={detail.data} />;
}

function CustomerEditor({ id, initial }: { id?: string; initial?: Customer }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [form, setForm] = useState<CustomerInput>(() => initial ? {
    code: initial.code, name: initial.name, businessName: initial.businessName ?? "", taxId: initial.taxId ?? "", contactName: initial.contactName ?? "", phone: initial.phone ?? "", email: initial.email ?? "", address: initial.address ?? "", notes: initial.notes ?? "", active: initial.active,
  } : empty);
  const mutation = useMutation({
    mutationFn: (body: CustomerInput) => id ? customersApi.update(id, body) : customersApi.create(body),
    onSuccess: async (row) => { client.setQueryData(queryKeys.customer(row.id), row); await invalidateCustomerReferenceIntegration(client); void navigate(`/app/sales/customers/${row.id}`, { replace: true }); },
  });
  const change = (field: keyof CustomerInput, value: string | boolean) => setForm((current) => ({ ...current, [field]: value }));
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({ ...form, businessName: form.businessName || undefined, taxId: form.taxId || undefined, contactName: form.contactName || undefined, phone: form.phone || undefined, email: form.email || undefined, address: form.address || undefined, notes: form.notes || undefined });
  }
  return <div className="page-stack"><PageHeader eyebrow="Ventas" title={id ? "Editar cliente" : "Nuevo cliente"} description="La desactivación impide nuevas ventas, sin eliminar el historial comercial." />
    <form className="panel erp-form" onSubmit={submit}><FormFeedback error={mutation.error ? apiErrorMessage(mutation.error) : null} /><div className="form-grid">
      <Field label="Código" htmlFor="customer-code" required><input id="customer-code" required minLength={2} maxLength={60} value={form.code} onChange={(e) => change("code", e.target.value)} /></Field>
      <Field label="Nombre" htmlFor="customer-name" required><input id="customer-name" required minLength={2} maxLength={160} value={form.name} onChange={(e) => change("name", e.target.value)} /></Field>
      <Field label="Razón social" htmlFor="customer-business"><input id="customer-business" maxLength={160} value={form.businessName} onChange={(e) => change("businessName", e.target.value)} /></Field>
      <Field label="RTN / identificación" htmlFor="customer-tax"><input id="customer-tax" maxLength={40} value={form.taxId} onChange={(e) => change("taxId", e.target.value)} /></Field>
      <Field label="Contacto" htmlFor="customer-contact"><input id="customer-contact" maxLength={120} value={form.contactName} onChange={(e) => change("contactName", e.target.value)} /></Field>
      <Field label="Teléfono" htmlFor="customer-phone"><input id="customer-phone" maxLength={40} value={form.phone} onChange={(e) => change("phone", e.target.value)} /></Field>
      <Field label="Correo" htmlFor="customer-email"><input id="customer-email" type="email" maxLength={160} value={form.email} onChange={(e) => change("email", e.target.value)} /></Field>
      <Field label="Dirección" htmlFor="customer-address"><textarea id="customer-address" maxLength={500} value={form.address} onChange={(e) => change("address", e.target.value)} /></Field>
      <Field label="Notas" htmlFor="customer-notes"><textarea id="customer-notes" maxLength={1000} value={form.notes} onChange={(e) => change("notes", e.target.value)} /></Field>
      <label className="check-field"><input type="checkbox" checked={form.active} onChange={(e) => change("active", e.target.checked)} />Cliente activo</label>
    </div><div className="form-actions"><Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancelar</Button><Button type="submit" loading={mutation.isPending}>Guardar cliente</Button></div></form>
  </div>;
}

export function CustomerDetailPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const detail = useQuery({ queryKey: queryKeys.customer(id), queryFn: () => customersApi.detail(id) });
  const params = { page, limit: 20 };
  const account = useQuery({ queryKey: queryKeys.customerAccount(id, params), queryFn: () => customersApi.account(id, params), enabled: hasPermission("commercial-receivables.read") });
  const lifecycle = useMutation({ mutationFn: () => customersApi.setActive(id, !detail.data?.active), onSuccess: async () => { await invalidateCustomerReferenceIntegration(client); setConfirm(false); } });
  if (detail.isLoading) return <div className="panel">Cargando cliente…</div>;
  if (!detail.data || detail.error) return <FormFeedback error={apiErrorMessage(detail.error)} />;
  const customer = detail.data;
  const columns: ErpColumn<ReceivableDocument>[] = [
    { key: "sale", header: "Venta", cell: (row) => <Link className="table-link" to={`/app/sales/${row.id}`}>#{row.number}</Link> },
    { key: "date", header: "Fecha", cell: (row) => formatCalendarDate(row.documentDate) },
    { key: "due", header: "Vence", cell: (row) => row.paymentDueDate ? formatCalendarDate(row.paymentDueDate) : "—" },
    { key: "status", header: "Liquidación", cell: (row) => <CommercialStatusBadge status={row.settlementStatus} /> },
    { key: "outstanding", header: "Pendiente", cell: (row) => formatMoney(row.outstandingAmount) },
  ];
  return <div className="page-stack"><PageHeader eyebrow="Clientes" title={`${customer.code} · ${customer.name}`} description={customer.businessName || "Cliente registrado"} actions={<><StatusBadge active={customer.active} />{hasPermission("customers.update") && <Link className="button button--secondary" to={`/app/sales/customers/${id}/edit`}>Editar</Link>}{hasPermission("customers.update") && <Button variant="danger" onClick={() => setConfirm(true)}>{customer.active ? "Desactivar" : "Activar"}</Button>}</>} />
    <section className="panel detail-grid"><div><span className="eyebrow">Contacto</span><p>{customer.contactName || "—"}</p><small>{customer.email || customer.phone || "Sin datos"}</small></div><div><span className="eyebrow">Identificación</span><p>{customer.taxId || "—"}</p></div><div><span className="eyebrow">Dirección</span><p>{customer.address || "—"}</p></div><div><span className="eyebrow">Notas</span><p>{customer.notes || "—"}</p></div></section>
    {hasPermission("commercial-receivables.read") ? <section className="panel"><h2>Estado de cuenta</h2>{account.data && <div className="metric-grid"><article className="metric-card"><span>Pendiente</span><strong>{formatMoney(account.data.summary.outstandingAmount)}</strong></article><article className="metric-card"><span>Vencido</span><strong>{formatMoney(account.data.summary.overdueAmount)}</strong></article><article className="metric-card"><span>Documentos</span><strong>{account.data.summary.documentCount}</strong></article></div>}<ErpTable columns={columns} rows={account.data?.data} rowKey={(row) => row.id} loading={account.isLoading} error={account.error ? apiErrorMessage(account.error) : undefined} emptyTitle="Sin ventas para este cliente" /><Pagination meta={account.data?.meta} onPageChange={setPage} /></section> : <section className="panel"><p>No tiene permiso para consultar el estado de cuenta.</p></section>}
    {lifecycle.error && <FormFeedback error={apiErrorMessage(lifecycle.error)} />}
    <ConfirmDialog open={confirm} title={`${customer.active ? "Desactivar" : "Activar"} cliente`} description="El historial comercial se conservará." confirmLabel={customer.active ? "Desactivar" : "Activar"} dangerous={customer.active} loading={lifecycle.isPending} onCancel={() => setConfirm(false)} onConfirm={() => lifecycle.mutate()} />
  </div>;
}
