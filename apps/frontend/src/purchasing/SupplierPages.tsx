import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { suppliersApi, type SupplierInput } from "../api/suppliers-api";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/Badge";
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
      key: "active",
      header: "Estado",
      cell: (row) => <StatusBadge active={row.active} />,
    },
  ];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Compras"
        title="Proveedores"
        description="Directorio comercial con historial preservado y búsqueda del servidor."
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
        <Field label="Buscar" htmlFor="supplier-search">
          <input
            id="supplier-search"
            placeholder="Código o razón social"
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
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </Field>
        <div className="filter-actions">
          <Button type="submit">Aplicar</Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearch("");
              filters.clear();
            }}
          >
            Limpiar
          </Button>
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
          emptyTitle="No se encontraron proveedores"
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
      await client.invalidateQueries({ queryKey: queryKeys.suppliersRoot });
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
        eyebrow="Compras"
        title={id ? "Editar proveedor" : "Nuevo proveedor"}
        description="Los datos históricos permanecen asociados aunque el proveedor se desactive."
      />
      <form className="panel erp-form" onSubmit={submit}>
        <FormFeedback
          error={mutation.error ? apiErrorMessage(mutation.error) : null}
        />
        <div className="form-grid">
          <Field label="Código" htmlFor="supplier-code" required>
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
          <Field label="Razón social" htmlFor="supplier-name" required>
            <input
              id="supplier-name"
              required
              minLength={2}
              maxLength={160}
              value={form.businessName}
              onChange={(event) =>
                setForm({ ...form, businessName: event.target.value })
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
          <Field label="Contacto" htmlFor="supplier-contact">
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
  const accountParams = { page: accountPage, limit: 20 };
  const account = useQuery({
    queryKey: queryKeys.supplierAccount(id, accountParams),
    queryFn: () => suppliersApi.account(id, accountParams),
    enabled: hasPermission("commercial-payables.read"),
  });
  const lifecycle = useMutation({
    mutationFn: () => suppliersApi.setActive(id, !detail.data?.active),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.supplier(id) }),
        client.invalidateQueries({ queryKey: queryKeys.suppliersRoot }),
      ]);
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
      header: "Obligación neta",
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
      header: "Crédito",
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
      header: "Liquidación",
      cell: (item) => <CommercialStatusBadge status={item.settlementStatus} />,
    },
  ];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Proveedor"
        title={`${row.code} · ${row.businessName}`}
        description={row.contactName || "Sin contacto principal"}
        actions={
          hasPermission("suppliers.update") ? (
            <div className="row-actions">
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
            </div>
          ) : undefined
        }
      />
      <section className="panel detail-card">
        <h2>Datos comerciales</h2>
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
              <h2>Cuenta por pagar</h2>
              <p>Resumen operacional derivado por el servidor.</p>
            </div>
            <Link
              className="button button--ghost"
              to={`/app/commercial/payables?supplierId=${id}`}
            >
              Abrir Cuentas por pagar
            </Link>
          </div>
          {account.data ? (
            <div className="commercial-summary-grid">
              <span>
                Compra bruta{" "}
                <strong>{formatMoney(account.data.summary.grossAmount)}</strong>
              </span>
              <span>
                Devoluciones{" "}
                <strong>
                  {formatMoney(account.data.summary.returnAmount)}
                </strong>
              </span>
              <span>
                Obligación neta{" "}
                <strong>{formatMoney(account.data.summary.netAmount)}</strong>
              </span>
              <span>
                Pagado{" "}
                <strong>{formatMoney(account.data.summary.paidAmount)}</strong>
              </span>
              <span>
                Reembolsado por proveedor{" "}
                <strong>
                  {formatMoney(account.data.summary.refundedAmount)}
                </strong>
              </span>
              <span>
                Pendiente{" "}
                <strong>
                  {formatMoney(account.data.summary.outstandingAmount)}
                </strong>
              </span>
              <span>
                Crédito proveedor{" "}
                <strong>
                  {formatMoney(account.data.summary.creditAmount)}
                </strong>
              </span>
              <span>
                Sin pagar <strong>{account.data.summary.unpaidCount}</strong>
              </span>
              <span>
                Pago parcial{" "}
                <strong>{account.data.summary.partiallyPaidCount}</strong>
              </span>
              <span>
                Pagadas <strong>{account.data.summary.paidCount}</strong>
              </span>
              <span>
                Vencidas <strong>{account.data.summary.overdueCount}</strong>
              </span>
              <span>
                Monto vencido{" "}
                <strong>
                  {formatMoney(account.data.summary.overdueAmount)}
                </strong>
              </span>
            </div>
          ) : null}
          <ErpTable
            columns={accountColumns}
            rows={account.data?.data}
            rowKey={(item) => item.id}
            loading={account.isLoading}
            error={account.error ? apiErrorMessage(account.error) : undefined}
            emptyTitle="Sin documentos en la cuenta"
          />
          <Pagination meta={account.data?.meta} onPageChange={setAccountPage} />
        </section>
      ) : null}
      <ConfirmDialog
        open={confirm}
        title={`${row.active ? "Desactivar" : "Activar"} proveedor`}
        description="El historial de compras se conservará. Un proveedor inactivo no podrá utilizarse en compras nuevas."
        dangerous={row.active}
        loading={lifecycle.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => lifecycle.mutate()}
      />
    </div>
  );
}
