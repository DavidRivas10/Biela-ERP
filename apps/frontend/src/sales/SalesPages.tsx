import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { salesApi } from "../api/sales-api";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { CommercialStatusBadge } from "../components/CommercialStatusBadge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { ErpTable, type ErpColumn } from "../components/ErpTable";
import { ProductSelector } from "../components/EntitySelectors";
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
import type { Sale, SaleReturn, SaleStatus } from "../types/sales";
import { apiErrorMessage } from "../utils/api-error";
import {
  formatCalendarDate,
  formatDateTime,
  formatMoney,
} from "../utils/formatters";

const statuses: SaleStatus[] = ["DRAFT", "POSTED", "CANCELLED"];

/** Plain-language names for the sale lifecycle (V6: "no entiendo estado"). */
const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  DRAFT: "Borrador",
  POSTED: "Confirmada",
  CANCELLED: "Cancelada",
};
const SALE_STATUS_FILTER_LABELS: Record<SaleStatus, string> = {
  DRAFT: "Borrador (empezada, sin confirmar)",
  POSTED: "Confirmada (ya descontó inventario)",
  CANCELLED: "Cancelada",
};

function SaleStatusChip({ status }: { status: SaleStatus }) {
  const tone =
    status === "POSTED"
      ? "success"
      : status === "CANCELLED"
        ? "danger"
        : "neutral";
  return (
    <span className={`badge badge--${tone}`}>
      {SALE_STATUS_LABELS[status]}
    </span>
  );
}

function saleParty(sale: Pick<Sale, "accountLabel" | "customer">): string {
  if (sale.accountLabel) return sale.accountLabel;
  if (sale.customer) return `${sale.customer.code} · ${sale.customer.name}`;
  return "Venta de mostrador";
}

/** The "Para" cell: says plainly who the sale is for and of what kind. */
function SaleParty({ sale }: { sale: Sale }) {
  if (sale.accountLabel) {
    return (
      <>
        <strong>{sale.accountLabel}</strong>
        <small>Cuenta abierta</small>
      </>
    );
  }
  if (sale.customer) {
    return (
      <>
        <strong>{sale.customer.name}</strong>
        <small>Cliente registrado · {sale.customer.code}</small>
      </>
    );
  }
  return (
    <>
      <strong>Mostrador</strong>
      <small>Sin cliente</small>
    </>
  );
}

function OpenAccountsPanel() {
  const openAccounts = useQuery({
    queryKey: queryKeys.sales({ openAccounts: true }),
    queryFn: () =>
      salesApi.list({
        status: "DRAFT",
        hasAccountLabel: true,
        page: 1,
        limit: 50,
      }),
  });
  const rows = openAccounts.data?.data ?? [];
  return (
    <section className="panel open-accounts">
      <div className="section-heading">
        <div>
          <h2>Cuentas abiertas</h2>
          <p>
            Ventas sin cerrar con una etiqueta. Se les van agregando productos
            durante el día y se cierran después.
          </p>
        </div>
      </div>
      {openAccounts.isLoading ? <p className="muted">Cargando…</p> : null}
      {!openAccounts.isLoading && rows.length === 0 ? (
        <p className="muted">No hay cuentas abiertas en este momento.</p>
      ) : null}
      {rows.length > 0 ? (
        <ul className="open-accounts__list">
          {rows.map((sale) => (
            <li key={sale.id}>
              <Link className="table-link" to={`/app/sales/${sale.id}`}>
                <strong>{sale.accountLabel}</strong>
                <small>
                  Cuenta #{sale.number} · {sale._count?.items ?? 0} líneas ·{" "}
                  {formatMoney(sale.total)}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function SalesPage() {
  const { hasPermission } = useAuth();
  const filters = useUrlFilters();
  const params = {
    page: filters.page,
    limit: filters.limit,
    customerId: filters.values.customerId,
    productId: filters.values.productId,
    status: filters.values.status,
    number: filters.values.number,
    from: filters.values.from,
    to: filters.values.to,
  };
  const list = useQuery({
    queryKey: queryKeys.sales(params),
    queryFn: () => salesApi.list(params),
  });
  const hasActiveFilters = Boolean(
    filters.values.customerId ||
      filters.values.productId ||
      filters.values.status ||
      filters.values.number ||
      filters.values.from ||
      filters.values.to,
  );
  const columns: ErpColumn<Sale>[] = [
    {
      key: "number",
      header: "Venta N.º",
      cell: (row) => (
        <Link className="table-link" to={`/app/sales/${row.id}`}>
          <strong>#{row.number}</strong>
          <small>
            {row._count?.items ?? 0}{" "}
            {(row._count?.items ?? 0) === 1 ? "producto" : "productos"}
          </small>
        </Link>
      ),
    },
    {
      key: "party",
      header: "Para quién",
      cell: (row) => <SaleParty sale={row} />,
    },
    {
      key: "date",
      header: "Fecha",
      cell: (row) => formatCalendarDate(row.documentDate),
    },
    {
      key: "due",
      header: "Vence el pago",
      cell: (row) =>
        row.paymentDueDate ? formatCalendarDate(row.paymentDueDate) : "—",
    },
    { key: "total", header: "Total", cell: (row) => formatMoney(row.total) },
    {
      key: "status",
      header: "Estado",
      cell: (row) => <SaleStatusChip status={row.status} />,
    },
  ];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Vender"
        title="Ventas"
        description="Todas las ventas: las de mostrador que se cobran al momento, las de clientes registrados y las cuentas abiertas que se cierran después."
        actions={
          hasPermission("sales.create") ? (
            <>
              <Link className="button button--primary" to="/app/sales/new">
                Registrar una venta
              </Link>
              <Link
                className="button button--secondary"
                to="/app/sales/new?mode=cuenta"
              >
                Abrir una cuenta
              </Link>
            </>
          ) : undefined
        }
      />
      <OpenAccountsPanel />
      <details className="filter-details" open={hasActiveFilters}>
        <summary>Buscar o filtrar ventas</summary>
        <div className="filter-bar">
          <CustomerSelector
            id="sales-customer-filter"
            label="Cliente registrado"
            value={filters.values.customerId ?? ""}
            emptyLabel="Cualquiera"
            onChange={(customerId) => filters.update({ customerId })}
          />
          <ProductSelector
            id="sales-product-filter"
            label="Producto vendido"
            value={filters.values.productId ?? ""}
            emptyLabel="Cualquiera"
            onChange={(productId) => filters.update({ productId })}
          />
          <Field label="Estado" htmlFor="sale-status">
            <select
              id="sale-status"
              value={filters.values.status ?? ""}
              onChange={(e) => filters.update({ status: e.target.value })}
            >
              <option value="">Cualquier estado</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {SALE_STATUS_FILTER_LABELS[status]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Número de venta"
            htmlFor="sale-number"
            hint="El # que aparece en cada venta (ej.: 4)."
          >
            <input
              id="sale-number"
              type="number"
              min={1}
              value={filters.values.number ?? ""}
              onChange={(e) => filters.update({ number: e.target.value })}
            />
          </Field>
          <Field label="Fecha desde" htmlFor="sale-from">
            <input
              id="sale-from"
              type="date"
              value={filters.values.from ?? ""}
              onChange={(e) => filters.update({ from: e.target.value })}
            />
          </Field>
          <Field label="Fecha hasta" htmlFor="sale-to">
            <input
              id="sale-to"
              type="date"
              value={filters.values.to ?? ""}
              onChange={(e) => filters.update({ to: e.target.value })}
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
                No hay ventas para el cliente, el producto, el estado, el número
                o las fechas que filtraste.
              </EmptyState>
            ) : (
              <EmptyState
                title="Todavía no registraste ventas"
                action={
                  hasPermission("sales.create") ? (
                    <Link
                      className="button button--primary"
                      to="/app/sales/new"
                    >
                      Registrar la primera venta
                    </Link>
                  ) : undefined
                }
              >
                Empezá con «Registrar una venta»: elegís quién compra (o nadie,
                si es de mostrador), agregás los productos y cobrás.
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

export function SaleDetailPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const [returnPage, setReturnPage] = useState(1);
  const [action, setAction] = useState<"post" | "cancel" | null>(null);
  const detail = useQuery({
    queryKey: queryKeys.sale(id),
    queryFn: () => salesApi.detail(id),
  });
  const returnParams = { page: returnPage, limit: 10 };
  const returns = useQuery({
    queryKey: queryKeys.saleReturns(id, returnParams),
    queryFn: () => salesApi.returns(id, returnParams),
    enabled: hasPermission("sales.read"),
  });
  const mutation = useMutation({
    mutationFn: () =>
      action === "post" ? salesApi.post(id) : salesApi.cancel(id),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.sale(id) }),
        client.invalidateQueries({ queryKey: queryKeys.salesRoot }),
        client.invalidateQueries({ queryKey: queryKeys.receivablesRoot }),
        client.invalidateQueries({ queryKey: queryKeys.customerAccountsRoot }),
        invalidateInventoryIntegration(client),
        invalidateCommercialSummary(client),
      ]);
      setAction(null);
    },
  });
  if (detail.isLoading) return <div className="panel">Cargando venta…</div>;
  if (!detail.data || detail.error)
    return <FormFeedback error={apiErrorMessage(detail.error)} />;
  const sale = detail.data;
  const isAccount = Boolean(sale.accountLabel);
  const returnColumns: ErpColumn<SaleReturn>[] = [
    {
      key: "number",
      header: "Devolución",
      cell: (row) => (
        <Link className="table-link" to={`/app/sales/returns/${row.id}`}>
          #{row.number}
        </Link>
      ),
    },
    { key: "reason", header: "Motivo", cell: (row) => row.reason },
    {
      key: "created",
      header: "Creada",
      cell: (row) => formatDateTime(row.createdAt),
    },
    {
      key: "status",
      header: "Estado",
      cell: (row) => <CommercialStatusBadge status={row.status} />,
    },
  ];
  const closeLabel = isAccount ? "Cerrar cuenta" : "Confirmar venta";
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Ventas"
        title={`${isAccount ? "Cuenta" : "Venta"} #${sale.number}`}
        description={saleParty(sale)}
        actions={
          <>
            <CommercialStatusBadge status={sale.status} />
            {sale.status === "DRAFT" && hasPermission("sales.update") && (
              <Link
                className="button button--secondary"
                to={
                  isAccount
                    ? `/app/sales/new?account=${id}`
                    : `/app/sales/new?customerSale=${id}`
                }
              >
                {isAccount ? "Agregar productos" : "Editar"}
              </Link>
            )}
            {sale.status === "DRAFT" && hasPermission("sales.post") && (
              <Button onClick={() => setAction("post")}>{closeLabel}</Button>
            )}
            {sale.status === "DRAFT" && hasPermission("sales.update") && (
              <Button variant="danger" onClick={() => setAction("cancel")}>
                Cancelar
              </Button>
            )}
            {sale.status === "POSTED" && hasPermission("sales.return") && (
              <Link
                className="button button--secondary"
                to={`/app/sales/${id}/returns`}
              >
                Nueva devolución
              </Link>
            )}
            {sale.status === "POSTED" &&
              (hasPermission("payments.read") ||
                hasPermission("payments.create")) && (
                <Link
                  className="button button--secondary"
                  to={`/app/sales/${id}/payments`}
                >
                  {hasPermission("payments.create") ? "Cobrar" : "Pagos"}
                </Link>
              )}
          </>
        }
      />
      {sale.status === "DRAFT" ? (
        <p className="muted">
          {isAccount
            ? "Cuenta abierta: seguí sumando piezas con «Agregar productos». Al terminar, «Cerrar cuenta» descuenta el inventario; después cobrás o la dejás a crédito en Cuentas por cobrar."
            : "Es un borrador: podés seguir editándolo. «Confirmar venta» descuenta el inventario y a partir de ahí ya no se puede editar."}
        </p>
      ) : null}
      <section className="panel detail-grid">
        {isAccount ? (
          <div>
            <span className="eyebrow">Etiqueta de la cuenta</span>
            <p>{sale.accountLabel}</p>
          </div>
        ) : null}
        <div>
          <span className="eyebrow">Fecha</span>
          <p>{formatCalendarDate(sale.documentDate)}</p>
        </div>
        <div>
          <span className="eyebrow">Vencimiento</span>
          <p>
            {sale.paymentDueDate
              ? formatCalendarDate(sale.paymentDueDate)
              : "—"}
          </p>
        </div>
        <div>
          <span className="eyebrow">Total</span>
          <p>{formatMoney(sale.total)}</p>
        </div>
        <div>
          <span className="eyebrow">Saldo pendiente</span>
          <p>
            {sale.paymentSummary
              ? formatMoney(sale.paymentSummary.outstandingAmount)
              : "—"}
          </p>
        </div>
      </section>
      <section className="panel">
        <h2>Líneas</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Origen</th>
                <th>Cantidad</th>
                <th>Devuelta</th>
                <th>Precio</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items?.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.product.code} · {item.product.name}
                  </td>
                  <td>{item.sourceLocation.code}</td>
                  <td>{item.quantity}</td>
                  <td>{item.returnedQuantity}</td>
                  <td>{formatMoney(item.unitPrice)}</td>
                  <td>{formatMoney(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Devoluciones</h2>
        <ErpTable
          columns={returnColumns}
          rows={returns.data?.data}
          rowKey={(row) => row.id}
          loading={returns.isLoading}
          error={returns.error ? apiErrorMessage(returns.error) : undefined}
          emptyTitle="Sin devoluciones"
        />
        <Pagination meta={returns.data?.meta} onPageChange={setReturnPage} />
      </section>
      {mutation.error && <FormFeedback error={apiErrorMessage(mutation.error)} />}
      <ConfirmDialog
        open={Boolean(action)}
        title={action === "post" ? closeLabel : "Cancelar venta"}
        description={
          action === "post"
            ? isAccount
              ? `Total final: ${formatMoney(sale.total)}. Se confirma la cuenta, se descuenta el inventario y no se pueden agregar más productos. Después registrás el pago o la dejás a crédito.`
              : `Total final: ${formatMoney(sale.total)}. Se descuenta el inventario y no se puede deshacer desde la venta.`
            : "Solo se cancela el borrador. No afecta el inventario."
        }
        confirmLabel={action === "post" ? closeLabel : "Cancelar venta"}
        dangerous={action === "cancel"}
        loading={mutation.isPending}
        onCancel={() => setAction(null)}
        onConfirm={() => mutation.mutate()}
      />
    </div>
  );
}
