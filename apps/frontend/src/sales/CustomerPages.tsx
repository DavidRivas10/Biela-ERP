import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { customersApi, type CustomerInput } from "../api/customers-api";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { CommercialStatusBadge } from "../components/CommercialStatusBadge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
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

const empty: CustomerInput = {
  code: "",
  name: "",
  businessName: "",
  taxId: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  active: true,
};

/**
 * Plain line — on the list, the form and the detail — that answers David's
 * "no sé si es crear un código de cliente" and separates *registering* a
 * customer from *selling* to one.
 */
const WHY_REGISTER =
  "Registrás un cliente cuando le vas a fiar (venta a crédito) o querés llevar su historial y su estado de cuenta. Para una venta de mostrador que se paga en el momento, no hace falta.";

function salesCountLabel(count: number | undefined): string {
  if (count === undefined) return "—";
  if (count === 0) return "Sin ventas aún";
  return `${count} ${count === 1 ? "venta" : "ventas"}`;
}

export function CustomersPage() {
  const { hasPermission } = useAuth();
  const filters = useUrlFilters();
  const [search, setSearch] = useState(filters.values.search ?? "");
  const params = {
    page: filters.page,
    limit: filters.limit,
    search: filters.values.search,
    active: filters.values.active,
  };
  const list = useQuery({
    queryKey: queryKeys.customers(params),
    queryFn: () => customersApi.list(params),
  });
  const canSell = hasPermission("sales.create");
  const hasActiveFilters = Boolean(
    filters.values.search || filters.values.active,
  );

  const columns: ErpColumn<Customer>[] = [
    {
      key: "customer",
      header: "Cliente",
      cell: (row) => (
        <Link
          className="table-link"
          to={`/app/sales/customers/${row.id}`}
        >
          <strong>{row.code}</strong>
          <small>{row.name}</small>
        </Link>
      ),
    },
    {
      key: "business",
      header: "Razón social",
      cell: (row) => row.businessName || "—",
    },
    {
      key: "contact",
      header: "Contacto",
      cell: (row) => (
        <>
          <span>{row.contactName || "—"}</span>
          <small>{row.email || row.phone || "Sin contacto"}</small>
        </>
      ),
    },
    {
      key: "sales",
      header: "Ventas",
      cell: (row) => salesCountLabel(row._count?.sales),
    },
    {
      key: "active",
      header: "Estado",
      cell: (row) => <StatusBadge active={row.active} />,
    },
    ...(canSell
      ? [
          {
            key: "actions",
            header: "Acciones",
            cell: (row: Customer) => (
              <Link
                className="button button--ghost"
                to={`/app/sales/new?customerId=${row.id}`}
              >
                Vender a este cliente
              </Link>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Vender"
        title="Clientes"
        description={WHY_REGISTER}
        actions={
          hasPermission("customers.create") ? (
            <Link
              className="button button--primary"
              to="/app/sales/customers/new"
            >
              Nuevo cliente
            </Link>
          ) : undefined
        }
      />
      <form
        className="panel filter-bar"
        onSubmit={(event) => {
          event.preventDefault();
          filters.update({ search });
        }}
      >
        <Field label="Buscar por código, nombre o razón social" htmlFor="customer-search">
          <input
            id="customer-search"
            placeholder="Ej.: TALLER-PROGRESO o «Taller El Progreso»"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        <Field label="Estado" htmlFor="customer-active">
          <select
            id="customer-active"
            value={filters.values.active ?? ""}
            onChange={(event) => filters.update({ active: event.target.value })}
          >
            <option value="">Activos e inactivos</option>
            <option value="true">Solo activos</option>
            <option value="false">Solo inactivos (ocultos)</option>
          </select>
        </Field>
        <div className="filter-actions">
          <Button type="submit">Buscar</Button>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch("");
                filters.clear();
              }}
            >
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      </form>
      <section className="panel">
        <ErpTable
          columns={columns}
          rows={list.data?.data}
          rowKey={(row) => row.id}
          loading={list.isLoading}
          error={list.error ? apiErrorMessage(list.error) : undefined}
          onRetry={() => void list.refetch()}
          emptyState={
            hasActiveFilters ? (
              <EmptyState
                tone="search"
                title="Ningún cliente coincide"
                action={
                  <Button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      filters.clear();
                    }}
                  >
                    Ver todos los clientes
                  </Button>
                }
              >
                {filters.values.search
                  ? `No hay ningún cliente con «${filters.values.search}». Puede que todavía no esté registrado — se registra solo si le vas a fiar o querés su historial.`
                  : "No hay clientes con ese estado."}
              </EmptyState>
            ) : (
              <EmptyState
                title="Todavía no hay clientes registrados"
                action={
                  hasPermission("customers.create") ? (
                    <Link
                      className="button button--primary"
                      to="/app/sales/customers/new"
                    >
                      Registrar un cliente
                    </Link>
                  ) : undefined
                }
              >
                {WHY_REGISTER}
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

export function CustomerFormPage() {
  const { id } = useParams();
  const detail = useQuery({
    queryKey: queryKeys.customer(id ?? "new"),
    queryFn: () => customersApi.detail(id!),
    enabled: Boolean(id),
  });
  if (id && detail.isLoading)
    return <div className="panel">Cargando cliente…</div>;
  if (id && detail.error)
    return <FormFeedback error={apiErrorMessage(detail.error)} />;
  return <CustomerEditor id={id} initial={detail.data} />;
}

function CustomerEditor({ id, initial }: { id?: string; initial?: Customer }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [form, setForm] = useState<CustomerInput>(() =>
    initial
      ? {
          code: initial.code,
          name: initial.name,
          businessName: initial.businessName ?? "",
          taxId: initial.taxId ?? "",
          contactName: initial.contactName ?? "",
          phone: initial.phone ?? "",
          email: initial.email ?? "",
          address: initial.address ?? "",
          notes: initial.notes ?? "",
          active: initial.active,
        }
      : empty,
  );
  const mutation = useMutation({
    mutationFn: (body: CustomerInput) =>
      id ? customersApi.update(id, body) : customersApi.create(body),
    onSuccess: async (row) => {
      client.setQueryData(queryKeys.customer(row.id), row);
      await invalidateCustomerReferenceIntegration(client);
      void navigate(`/app/sales/customers/${row.id}`, { replace: true });
    },
  });
  const change = (field: keyof CustomerInput, value: string | boolean) =>
    setForm((current) => ({ ...current, [field]: value }));
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({
      ...form,
      businessName: form.businessName || undefined,
      taxId: form.taxId || undefined,
      contactName: form.contactName || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      notes: form.notes || undefined,
    });
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Vender"
        title={id ? "Editar cliente" : "Nuevo cliente"}
        description={
          id
            ? "Cambiá los datos de contacto e identificación de este cliente."
            : `Un cliente registrado guarda sus datos, su historial de compras y su estado de cuenta. ${WHY_REGISTER}`
        }
      />
      <form className="panel erp-form" onSubmit={submit}>
        <FormFeedback
          error={mutation.error ? apiErrorMessage(mutation.error) : null}
        />
        <div className="form-grid">
          <Field label="Nombre" htmlFor="customer-name" required>
            <input
              id="customer-name"
              required
              minLength={2}
              maxLength={160}
              placeholder="Taller El Progreso"
              value={form.name}
              onChange={(e) => change("name", e.target.value)}
            />
          </Field>
          <Field
            label="Código"
            htmlFor="customer-code"
            required
            hint="Identificador corto y único para encontrarlo rápido (ej.: TALLER-PROGRESO). Si no usás códigos, algo simple como sus iniciales o su teléfono sirve."
          >
            <input
              id="customer-code"
              required
              minLength={2}
              maxLength={60}
              value={form.code}
              onChange={(e) => change("code", e.target.value)}
            />
          </Field>
          <Field
            label="Razón social"
            htmlFor="customer-business"
            hint="El nombre legal, si factura con uno distinto al de arriba."
          >
            <input
              id="customer-business"
              maxLength={160}
              value={form.businessName}
              onChange={(e) => change("businessName", e.target.value)}
            />
          </Field>
          <Field label="RTN / identificación" htmlFor="customer-tax">
            <input
              id="customer-tax"
              maxLength={40}
              value={form.taxId}
              onChange={(e) => change("taxId", e.target.value)}
            />
          </Field>
          <Field label="Persona de contacto" htmlFor="customer-contact">
            <input
              id="customer-contact"
              maxLength={120}
              value={form.contactName}
              onChange={(e) => change("contactName", e.target.value)}
            />
          </Field>
          <Field label="Teléfono" htmlFor="customer-phone">
            <input
              id="customer-phone"
              maxLength={40}
              value={form.phone}
              onChange={(e) => change("phone", e.target.value)}
            />
          </Field>
          <Field label="Correo" htmlFor="customer-email">
            <input
              id="customer-email"
              type="email"
              maxLength={160}
              value={form.email}
              onChange={(e) => change("email", e.target.value)}
            />
          </Field>
          <Field label="Dirección" htmlFor="customer-address">
            <textarea
              id="customer-address"
              maxLength={500}
              value={form.address}
              onChange={(e) => change("address", e.target.value)}
            />
          </Field>
          <Field label="Notas" htmlFor="customer-notes">
            <textarea
              id="customer-notes"
              maxLength={1000}
              value={form.notes}
              onChange={(e) => change("notes", e.target.value)}
            />
          </Field>
          <label className="check-field">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => change("active", e.target.checked)}
            />{" "}
            Cliente activo
          </label>
        </div>
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Guardar cliente
          </Button>
        </div>
      </form>
    </div>
  );
}

export function CustomerDetailPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const detail = useQuery({
    queryKey: queryKeys.customer(id),
    queryFn: () => customersApi.detail(id),
  });
  const params = { page, limit: 20 };
  const account = useQuery({
    queryKey: queryKeys.customerAccount(id, params),
    queryFn: () => customersApi.account(id, params),
    enabled: hasPermission("commercial-receivables.read"),
  });
  const lifecycle = useMutation({
    mutationFn: () => customersApi.setActive(id, !detail.data?.active),
    onSuccess: async () => {
      await invalidateCustomerReferenceIntegration(client);
      setConfirm(false);
    },
  });
  if (detail.isLoading) return <div className="panel">Cargando cliente…</div>;
  if (!detail.data || detail.error)
    return <FormFeedback error={apiErrorMessage(detail.error)} />;
  const customer = detail.data;
  const columns: ErpColumn<ReceivableDocument>[] = [
    {
      key: "sale",
      header: "Venta",
      cell: (row) => (
        <Link className="table-link" to={`/app/sales/${row.id}`}>
          #{row.number}
        </Link>
      ),
    },
    {
      key: "date",
      header: "Fecha",
      cell: (row) => formatCalendarDate(row.documentDate),
    },
    {
      key: "due",
      header: "Vence",
      cell: (row) =>
        row.paymentDueDate ? formatCalendarDate(row.paymentDueDate) : "—",
    },
    {
      key: "status",
      header: "Estado del pago",
      cell: (row) => <CommercialStatusBadge status={row.settlementStatus} />,
    },
    {
      key: "outstanding",
      header: "Pendiente",
      cell: (row) => formatMoney(row.outstandingAmount),
    },
  ];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Cliente"
        title={`${customer.code} · ${customer.name}`}
        description={customer.businessName || "Sin razón social"}
        actions={
          <>
            <StatusBadge active={customer.active} />
            {hasPermission("sales.create") && customer.active ? (
              <Link
                className="button button--primary"
                to={`/app/sales/new?customerId=${id}`}
              >
                Registrar una venta
              </Link>
            ) : null}
            {hasPermission("customers.update") && (
              <Link
                className="button button--secondary"
                to={`/app/sales/customers/${id}/edit`}
              >
                Editar
              </Link>
            )}
            {hasPermission("customers.update") && (
              <Button variant="danger" onClick={() => setConfirm(true)}>
                {customer.active ? "Desactivar" : "Activar"}
              </Button>
            )}
          </>
        }
      />
      <section className="panel detail-grid">
        <div>
          <span className="eyebrow">Contacto</span>
          <p>{customer.contactName || "—"}</p>
          <small>{customer.email || customer.phone || "Sin datos"}</small>
        </div>
        <div>
          <span className="eyebrow">Identificación</span>
          <p>{customer.taxId || "—"}</p>
        </div>
        <div>
          <span className="eyebrow">Dirección</span>
          <p>{customer.address || "—"}</p>
        </div>
        <div>
          <span className="eyebrow">Notas</span>
          <p>{customer.notes || "—"}</p>
        </div>
      </section>
      {hasPermission("commercial-receivables.read") ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Estado de cuenta</h2>
              <p>Ventas de este cliente y cuánto te debe todavía.</p>
            </div>
          </div>
          {account.data && (
            <div className="metrics-grid">
              <article className="metric-card">
                <span>Te debe</span>
                <strong>
                  {formatMoney(account.data.summary.outstandingAmount)}
                </strong>
              </article>
              <article className="metric-card">
                <span>Vencido</span>
                <strong>
                  {formatMoney(account.data.summary.overdueAmount)}
                </strong>
              </article>
              <article className="metric-card">
                <span>Ventas</span>
                <strong>{account.data.summary.documentCount}</strong>
              </article>
            </div>
          )}
          <ErpTable
            columns={columns}
            rows={account.data?.data}
            rowKey={(row) => row.id}
            loading={account.isLoading}
            error={account.error ? apiErrorMessage(account.error) : undefined}
            emptyTitle="Este cliente todavía no tiene ventas"
            emptyDescription="Cuando le registres una venta aparecerá acá, con lo que quede pendiente de pago."
          />
          <Pagination meta={account.data?.meta} onPageChange={setPage} />
        </section>
      ) : (
        <section className="panel">
          <p>No tenés permiso para consultar el estado de cuenta.</p>
        </section>
      )}
      {lifecycle.error && (
        <FormFeedback error={apiErrorMessage(lifecycle.error)} />
      )}
      <ConfirmDialog
        open={confirm}
        title={`${customer.active ? "Desactivar" : "Activar"} cliente`}
        description="El historial comercial se conserva. Un cliente inactivo no aparece al registrar ventas nuevas."
        confirmLabel={customer.active ? "Desactivar" : "Activar"}
        dangerous={customer.active}
        loading={lifecycle.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => lifecycle.mutate()}
      />
    </div>
  );
}
