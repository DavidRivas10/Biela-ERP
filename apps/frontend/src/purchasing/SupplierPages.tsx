import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { suppliersApi, type SupplierInput } from "../api/suppliers-api";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/Badge";
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
import { invalidateSupplierReferenceIntegration } from "../query/invalidation";
import type { PayableDocument, Supplier } from "../types/purchasing";
import { apiErrorMessage } from "../utils/api-error";
import { formatCalendarDate, formatMoney } from "../utils/formatters";

const emptySupplier: SupplierInput = {
  code: "",
  businessName: "",
  taxId: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  active: true,
};

export function SuppliersPage() {
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
    queryKey: queryKeys.suppliers(params),
    queryFn: () => suppliersApi.list(params),
  });
  const canBuy = hasPermission("purchases.create");
  const hasActiveFilters = Boolean(
    filters.values.search || filters.values.active,
  );
  const columns: ErpColumn<Supplier>[] = [
    {
      key: "supplier",
      header: "Proveedor",
      cell: (row) => (
        <Link className="table-link" to={`/app/purchasing/suppliers/${row.id}`}>
          <strong>{row.code}</strong>
          <small>{row.businessName}</small>
        </Link>
      ),
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
      key: "tax",
      header: "RTN / identificación",
      cell: (row) => row.taxId || "—",
    },
    {
      key: "purchases",
      header: "Compras",
      cell: (row) =>
        row._count?.purchases === undefined
          ? "—"
          : row._count.purchases === 0
            ? "Sin compras aún"
            : `${row._count.purchases} ${
                row._count.purchases === 1 ? "compra" : "compras"
              }`,
    },
    {
      key: "active",
      header: "Estado",
      cell: (row) => <StatusBadge active={row.active} />,
    },
    ...(canBuy
      ? [
          {
            key: "actions",
            header: "Acciones",
            cell: (row: Supplier) => (
              <Link
                className="button button--ghost"
                to={`/app/purchasing/purchases/new?supplierId=${row.id}`}
              >
                Registrar una factura
              </Link>
            ),
          },
        ]
      : []),
  ];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Comprar"
        title="Proveedores"
        description="A quién le comprás mercadería. Cada proveedor guarda sus datos, tu historial de compras y cuánto le debés. Un proveedor inactivo se conserva en el historial pero no aparece al registrar compras nuevas."
        actions={
          hasPermission("suppliers.create") ? (
            <Link
              className="button button--primary"
              to="/app/purchasing/suppliers/new"
            >
              Nuevo proveedor
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
        <Field label="Buscar por código o razón social" htmlFor="supplier-search">
          <input
            id="supplier-search"
            placeholder="Ej.: SUP-001 o «Repuestos del Sur»"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        <Field label="Estado" htmlFor="supplier-active">
          <select
            id="supplier-active"
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
                title="Ningún proveedor coincide"
                action={
                  <Button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      filters.clear();
                    }}
                  >
                    Ver todos los proveedores
                  </Button>
                }
              >
                {filters.values.search
                  ? `No hay ningún proveedor con «${filters.values.search}».`
                  : "No hay proveedores con ese estado."}
              </EmptyState>
            ) : (
              <EmptyState
                title="Todavía no registraste proveedores"
                action={
                  hasPermission("suppliers.create") ? (
                    <Link
                      className="button button--primary"
                      to="/app/purchasing/suppliers/new"
                    >
                      Registrar un proveedor
                    </Link>
                  ) : undefined
                }
              >
                Registrá a quienes les comprás mercadería. Los vas a poder elegir
                al cargar una factura.
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

export function SupplierFormPage() {
  const { id } = useParams();
  const detail = useQuery({
    queryKey: queryKeys.supplier(id ?? "new"),
    queryFn: () => suppliersApi.detail(id!),
    enabled: Boolean(id),
  });
  if (id && detail.isLoading)
    return <div className="panel">Cargando proveedor…</div>;
  if (id && detail.error)
    return <FormFeedback error={apiErrorMessage(detail.error)} />;
  return <SupplierFormEditor id={id} initial={detail.data} />;
}

function SupplierFormEditor({
  id,
  initial,
}: {
  id?: string;
  initial?: Supplier;
}) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [form, setForm] = useState<SupplierInput>(() =>
    initial
      ? {
          code: initial.code,
          businessName: initial.businessName,
          taxId: initial.taxId ?? "",
          contactName: initial.contactName ?? "",
          phone: initial.phone ?? "",
          email: initial.email ?? "",
          address: initial.address ?? "",
          notes: initial.notes ?? "",
          active: initial.active,
        }
      : emptySupplier,
  );
  const mutation = useMutation({
    mutationFn: (body: SupplierInput) =>
      id ? suppliersApi.update(id, body) : suppliersApi.create(body),
    onSuccess: async (row) => {
      client.setQueryData(queryKeys.supplier(row.id), row);
      await invalidateSupplierReferenceIntegration(client);
      void navigate(`/app/purchasing/suppliers/${row.id}`, {
        replace: true,
        state: {
          success: `Proveedor ${id ? "actualizado" : "creado"} correctamente.`,
        },
      });
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({
      ...form,
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
        eyebrow="Comprar"
        title={id ? "Editar proveedor" : "Nuevo proveedor"}
        description={
          id
            ? "Cambiá los datos de contacto e identificación de este proveedor."
            : "Registrá a quien le comprás mercadería. Sus datos, tu historial de compras y lo que le debés quedan guardados aunque después lo desactives."
        }
      />
      <form className="panel erp-form" onSubmit={submit}>
        <FormFeedback
          error={mutation.error ? apiErrorMessage(mutation.error) : null}
        />
        <div className="form-grid">
          <Field label="Razón social" htmlFor="supplier-name" required>
            <input
              id="supplier-name"
              required
              minLength={2}
              maxLength={160}
              placeholder="Repuestos del Sur S.A."
              value={form.businessName}
              onChange={(event) =>
                setForm({ ...form, businessName: event.target.value })
              }
            />
          </Field>
          <Field
            label="Código"
            htmlFor="supplier-code"
            required
            hint="Identificador corto y único para encontrarlo rápido (ej.: REP-SUR). Si no usás códigos, algo simple sirve."
          >
            <input
              id="supplier-code"
              required
              minLength={2}
              maxLength={60}
              value={form.code}
              onChange={(event) =>
                setForm({ ...form, code: event.target.value })
              }
            />
          </Field>
          <Field label="RTN / identificación" htmlFor="supplier-tax">
            <input
              id="supplier-tax"
              maxLength={40}
              value={form.taxId}
              onChange={(e) => setForm({ ...form, taxId: e.target.value })}
            />
          </Field>
          <Field label="Persona de contacto" htmlFor="supplier-contact">
            <input
              id="supplier-contact"
              maxLength={120}
              value={form.contactName}
              onChange={(e) =>
                setForm({ ...form, contactName: e.target.value })
              }
            />
          </Field>
          <Field label="Teléfono" htmlFor="supplier-phone">
            <input
              id="supplier-phone"
              maxLength={40}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Correo" htmlFor="supplier-email">
            <input
              id="supplier-email"
              type="email"
              maxLength={160}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Dirección" htmlFor="supplier-address">
            <textarea
              id="supplier-address"
              maxLength={500}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
          <Field label="Notas" htmlFor="supplier-notes">
            <textarea
              id="supplier-notes"
              maxLength={1000}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <label className="check-field">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Proveedor activo
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
            Guardar proveedor
          </Button>
        </div>
      </form>
    </div>
  );
}

export function SupplierDetailPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const [accountPage, setAccountPage] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const detail = useQuery({
    queryKey: queryKeys.supplier(id),
    queryFn: () => suppliersApi.detail(id),
  });
  const accountParams = { page: accountPage, limit: 10 };
  const account = useQuery({
    queryKey: queryKeys.supplierAccount(id, accountParams),
    queryFn: () => suppliersApi.account(id, accountParams),
    enabled: hasPermission("commercial-payables.read"),
  });
  const lifecycle = useMutation({
    mutationFn: () => suppliersApi.setActive(id, !detail.data?.active),
    onSuccess: async () => {
      await invalidateSupplierReferenceIntegration(client);
      setConfirm(false);
    },
  });
  if (detail.isLoading) return <div className="panel">Cargando proveedor…</div>;
  if (!detail.data || detail.error)
    return (
      <FormFeedback
        error={
          detail.error
            ? apiErrorMessage(detail.error)
            : "Proveedor no encontrado."
        }
      />
    );
  const row = detail.data;
  const accountColumns: ErpColumn<PayableDocument>[] = [
    {
      key: "number",
      header: "Compra",
      cell: (item) => (
        <Link
          className="table-link"
          to={`/app/purchasing/purchases/${item.id}`}
        >
          #{item.number}
        </Link>
      ),
    },
    {
      key: "date",
      header: "Fecha",
      cell: (item) => formatCalendarDate(item.documentDate),
    },
    {
      key: "net",
      header: "A pagar",
      cell: (item) => formatMoney(item.netPurchaseObligation),
    },
    {
      key: "paid",
      header: "Pagado",
      cell: (item) => formatMoney(item.netPaidAmount),
    },
    {
      key: "outstanding",
      header: "Pendiente",
      cell: (item) => formatMoney(item.outstandingAmount),
    },
    {
      key: "credit",
      header: "A favor",
      cell: (item) => formatMoney(item.supplierCreditAmount),
    },
    {
      key: "due",
      header: "Vencimiento",
      cell: (item) => (
        <>
          <span>
            {item.paymentDueDate
              ? formatCalendarDate(item.paymentDueDate)
              : "—"}
          </span>
          {item.overdue ? (
            <Badge tone="danger">Vencida · {item.ageInDays} días</Badge>
          ) : null}
        </>
      ),
    },
    {
      key: "status",
      header: "Estado del pago",
      cell: (item) => <CommercialStatusBadge status={item.settlementStatus} />,
    },
  ];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Comprar"
        title={`${row.code} · ${row.businessName}`}
        description={
          row._count?.purchases
            ? `${row._count.purchases} ${
                row._count.purchases === 1 ? "compra" : "compras"
              } registradas`
            : "Todavía sin compras"
        }
        actions={
          <div className="row-actions">
            {hasPermission("purchases.create") && row.active ? (
              <Link
                className="button button--primary"
                to={`/app/purchasing/purchases/new?supplierId=${id}`}
              >
                Registrar una factura
              </Link>
            ) : null}
            {hasPermission("suppliers.update") ? (
              <>
                <Link
                  className="button button--secondary"
                  to={`/app/purchasing/suppliers/${id}/edit`}
                >
                  Editar
                </Link>
                <Button
                  variant={row.active ? "danger" : "primary"}
                  onClick={() => setConfirm(true)}
                >
                  {row.active ? "Desactivar" : "Activar"}
                </Button>
              </>
            ) : null}
          </div>
        }
      />
      <section className="panel detail-card">
        <h2>Datos del proveedor</h2>
        <dl>
          <div>
            <dt>Estado</dt>
            <dd>
              <StatusBadge active={row.active} />
            </dd>
          </div>
          <div>
            <dt>RTN / identificación</dt>
            <dd>{row.taxId || "—"}</dd>
          </div>
          <div>
            <dt>Teléfono</dt>
            <dd>{row.phone || "—"}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>{row.email || "—"}</dd>
          </div>
          <div>
            <dt>Dirección</dt>
            <dd>{row.address || "—"}</dd>
          </div>
          <div>
            <dt>Notas</dt>
            <dd>{row.notes || "—"}</dd>
          </div>
        </dl>
      </section>
      {hasPermission("commercial-payables.read") ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Cuánto le debés</h2>
              <p>Compras de este proveedor y lo que queda pendiente de pago.</p>
            </div>
            <Link
              className="button button--ghost"
              to={`/app/commercial/payables?supplierId=${id}`}
            >
              Abrir cuentas por pagar
            </Link>
          </div>
          {account.data ? (
            <div className="metrics-grid">
              <article className="metric-card">
                <span>Le debés</span>
                <strong>
                  {formatMoney(account.data.summary.outstandingAmount)}
                </strong>
              </article>
              <article className="metric-card">
                <span>Vencido</span>
                <strong>
                  {formatMoney(account.data.summary.overdueAmount)}
                </strong>
                <small>
                  {account.data.summary.overdueCount} compras atrasadas
                </small>
              </article>
              <article className="metric-card">
                <span>Compras</span>
                <strong>{account.data.summary.documentCount}</strong>
              </article>
              <article className="metric-card">
                <span>A tu favor (crédito)</span>
                <strong>
                  {formatMoney(account.data.summary.creditAmount)}
                </strong>
              </article>
            </div>
          ) : null}
          <ErpTable
            columns={accountColumns}
            rows={account.data?.data}
            rowKey={(item) => item.id}
            loading={account.isLoading}
            error={account.error ? apiErrorMessage(account.error) : undefined}
            emptyTitle="Este proveedor todavía no tiene compras"
          />
          <Pagination meta={account.data?.meta} onPageChange={setAccountPage} />
        </section>
      ) : null}
      <ConfirmDialog
        open={confirm}
        title={`${row.active ? "Desactivar" : "Activar"} proveedor`}
        description="El historial de compras se conserva. Un proveedor inactivo no aparece al registrar compras nuevas."
        dangerous={row.active}
        loading={lifecycle.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => lifecycle.mutate()}
      />
    </div>
  );
}
