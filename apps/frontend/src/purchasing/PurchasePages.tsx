import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { purchasingApi, type PurchaseInput } from "../api/purchasing-api";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { CommercialStatusBadge } from "../components/CommercialStatusBadge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ErpTable, type ErpColumn } from "../components/ErpTable";
import { Field } from "../components/Field";
import { FormFeedback } from "../components/FormFeedback";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { ProductSelector } from "../components/EntitySelectors";
import { SupplierSelector } from "../components/PurchasingSelectors";
import { useUrlFilters } from "../hooks/use-url-filters";
import { queryKeys } from "../query/query-keys";
import type {
  Purchase,
  PurchaseReceipt,
  PurchaseReturn,
  PurchaseStatus,
} from "../types/purchasing";
import { apiErrorMessage } from "../utils/api-error";
import {
  formatCalendarDate,
  formatDateTime,
  formatMoney,
} from "../utils/formatters";

const purchaseStatuses: PurchaseStatus[] = [
  "DRAFT",
  "CONFIRMED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
];

export function PurchasesPage() {
  const { hasPermission } = useAuth();
  const filters = useUrlFilters();
  const params = {
    page: filters.page,
    limit: filters.limit,
    supplierId: filters.values.supplierId,
    status: filters.values.status,
    number: filters.values.number,
    supplierDocumentNumber: filters.values.supplierDocumentNumber,
    from: filters.values.from,
    to: filters.values.to,
  };
  const list = useQuery({
    queryKey: queryKeys.purchases(params),
    queryFn: () => purchasingApi.purchases(params),
  });
  const columns: ErpColumn<Purchase>[] = [
    {
      key: "number",
      header: "Compra",
      cell: (row) => (
        <Link className="table-link" to={`/app/purchasing/purchases/${row.id}`}>
          <strong>#{row.number}</strong>
          <small>
            {row.supplierDocumentNumber || "Sin documento proveedor"}
          </small>
        </Link>
      ),
    },
    {
      key: "supplier",
      header: "Proveedor",
      cell: (row) => (
        <>
          <strong>{row.supplier.code}</strong>
          <small>{row.supplier.businessName}</small>
        </>
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
    { key: "total", header: "Total", cell: (row) => formatMoney(row.total) },
    {
      key: "status",
      header: "Estado",
      cell: (row) => <CommercialStatusBadge status={row.status} />,
    },
  ];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Compras"
        title="Compras"
        description="Órdenes de compra y su ciclo de confirmación, recepción y liquidación."
        actions={
          hasPermission("purchases.create") ? (
            <Link
              className="button button--primary"
              to="/app/purchasing/purchases/new"
            >
              Nueva compra
            </Link>
          ) : undefined
        }
      />
      <section className="panel filter-bar">
        <SupplierSelector
          id="purchase-supplier-filter"
          label="Proveedor"
          value={filters.values.supplierId ?? ""}
          emptyLabel="Todos"
          onChange={(supplierId) => filters.update({ supplierId })}
        />
        <Field label="Estado" htmlFor="purchase-status-filter">
          <select
            id="purchase-status-filter"
            value={filters.values.status ?? ""}
            onChange={(e) => filters.update({ status: e.target.value })}
          >
            <option value="">Todos</option>
            {purchaseStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Número" htmlFor="purchase-number-filter">
          <input
            id="purchase-number-filter"
            type="number"
            min={1}
            value={filters.values.number ?? ""}
            onChange={(e) => filters.update({ number: e.target.value })}
          />
        </Field>
        <Field label="Documento proveedor" htmlFor="purchase-document-filter">
          <input
            id="purchase-document-filter"
            value={filters.values.supplierDocumentNumber ?? ""}
            onChange={(e) =>
              filters.update({ supplierDocumentNumber: e.target.value })
            }
          />
        </Field>
        <Field label="Desde" htmlFor="purchase-from">
          <input
            id="purchase-from"
            type="date"
            value={filters.values.from ?? ""}
            onChange={(e) => filters.update({ from: e.target.value })}
          />
        </Field>
        <Field label="Hasta" htmlFor="purchase-to">
          <input
            id="purchase-to"
            type="date"
            value={filters.values.to ?? ""}
            onChange={(e) => filters.update({ to: e.target.value })}
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
          emptyTitle="No se encontraron compras"
        />
        <Pagination
          meta={list.data?.meta}
          onPageChange={(page) => filters.update({ page }, false)}
        />
      </section>
    </div>
  );
}

type PurchaseLineForm = {
  key: number;
  productId: string;
  orderedQuantity: string;
  unitCost: string;
  discountAmount: string;
  taxAmount: string;
};
const newLine = (key: number): PurchaseLineForm => ({
  key,
  productId: "",
  orderedQuantity: "1",
  unitCost: "",
  discountAmount: "0.00",
  taxAmount: "0.00",
});

export function PurchaseFormPage() {
  const { id } = useParams();
  const detail = useQuery({
    queryKey: queryKeys.purchase(id ?? "new"),
    queryFn: () => purchasingApi.purchase(id!),
    enabled: Boolean(id),
  });
  if (id && detail.isLoading)
    return <div className="panel">Cargando compra…</div>;
  if (id && detail.error)
    return <FormFeedback error={apiErrorMessage(detail.error)} />;
  if (id && detail.data?.status !== "DRAFT")
    return <FormFeedback error="Solo las compras DRAFT pueden editarse." />;
  return <PurchaseFormEditor id={id} initial={detail.data} />;
}

function PurchaseFormEditor({
  id,
  initial,
}: {
  id?: string;
  initial?: Purchase;
}) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? "");
  const [supplierDocumentNumber, setSupplierDocumentNumber] = useState(
    initial?.supplierDocumentNumber ?? "",
  );
  const [documentDate, setDocumentDate] = useState(
    initial?.documentDate.slice(0, 10) ?? "",
  );
  const [paymentDueDate, setPaymentDueDate] = useState(
    initial?.paymentDueDate?.slice(0, 10) ?? "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lines, setLines] = useState<PurchaseLineForm[]>(() =>
    initial
      ? (initial.items ?? []).map((item, index) => ({
          key: index + 1,
          productId: item.productId,
          orderedQuantity: String(item.orderedQuantity),
          unitCost: item.unitCost,
          discountAmount: item.discountAmount,
          taxAmount: item.taxAmount,
        }))
      : [newLine(1)],
  );
  const [formError, setFormError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (body: PurchaseInput) =>
      id
        ? purchasingApi.updatePurchase(id, body)
        : purchasingApi.createPurchase(body),
    onSuccess: async (row) => {
      client.setQueryData(queryKeys.purchase(row.id), row);
      await client.invalidateQueries({ queryKey: queryKeys.purchasesRoot });
      void navigate(`/app/purchasing/purchases/${row.id}`, { replace: true });
    },
  });
  const duplicateProducts = useMemo(() => {
    const ids = lines.map((line) => line.productId).filter(Boolean);
    return new Set(ids).size !== ids.length;
  }, [lines]);
  function updateLine(key: number, changes: Partial<PurchaseLineForm>) {
    setLines((current) =>
      current.map((line) =>
        line.key === key ? { ...line, ...changes } : line,
      ),
    );
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (duplicateProducts) {
      setFormError("Un producto solo puede aparecer una vez en la compra.");
      return;
    }
    setFormError(null);
    mutation.mutate({
      supplierId,
      supplierDocumentNumber: supplierDocumentNumber || undefined,
      documentDate,
      paymentDueDate: paymentDueDate || undefined,
      notes: notes || undefined,
      items: lines.map((line) => ({
        productId: line.productId,
        orderedQuantity: Number(line.orderedQuantity),
        unitCost: line.unitCost,
        discountAmount: line.discountAmount || undefined,
        taxAmount: line.taxAmount || undefined,
      })),
    });
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Compras"
        title={id ? "Editar compra" : "Nueva compra"}
        description="El total definitivo será calculado y devuelto por el servidor con precisión decimal."
      />
      <form className="panel erp-form" onSubmit={submit}>
        <FormFeedback
          error={
            formError ??
            (mutation.error ? apiErrorMessage(mutation.error) : null)
          }
        />
        <div className="form-grid">
          <SupplierSelector
            id="purchase-supplier"
            label="Proveedor"
            required
            value={supplierId}
            onChange={setSupplierId}
          />
          <Field label="Documento del proveedor" htmlFor="purchase-document">
            <input
              id="purchase-document"
              maxLength={80}
              value={supplierDocumentNumber}
              onChange={(e) => setSupplierDocumentNumber(e.target.value)}
            />
          </Field>
          <Field label="Fecha del documento" htmlFor="purchase-date" required>
            <input
              id="purchase-date"
              type="date"
              required
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
            />
          </Field>
          <Field label="Fecha de vencimiento" htmlFor="purchase-due">
            <input
              id="purchase-due"
              type="date"
              value={paymentDueDate}
              onChange={(e) => setPaymentDueDate(e.target.value)}
            />
          </Field>
          <Field label="Notas" htmlFor="purchase-notes">
            <textarea
              id="purchase-notes"
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
        <fieldset className="form-section purchase-lines">
          <legend>Productos</legend>
          <p>
            La vista no suma importes como fuente de verdad; el total exacto
            aparecerá después de guardar.
          </p>
          {lines.map((line, index) => (
            <div className="purchase-line" key={line.key}>
              <ProductSelector
                id={`purchase-product-${line.key}`}
                label={`Producto ${index + 1}`}
                required
                value={line.productId}
                onChange={(productId) => updateLine(line.key, { productId })}
              />
              <Field
                label="Cantidad"
                htmlFor={`purchase-quantity-${line.key}`}
                required
              >
                <input
                  id={`purchase-quantity-${line.key}`}
                  required
                  type="number"
                  min={1}
                  step={1}
                  value={line.orderedQuantity}
                  onChange={(e) =>
                    updateLine(line.key, { orderedQuantity: e.target.value })
                  }
                />
              </Field>
              <Field
                label="Costo unitario"
                htmlFor={`purchase-cost-${line.key}`}
                required
              >
                <input
                  id={`purchase-cost-${line.key}`}
                  required
                  inputMode="decimal"
                  pattern="\d+(\.\d{1,4})?"
                  value={line.unitCost}
                  onChange={(e) =>
                    updateLine(line.key, { unitCost: e.target.value })
                  }
                />
              </Field>
              <Field
                label="Descuento"
                htmlFor={`purchase-discount-${line.key}`}
              >
                <input
                  id={`purchase-discount-${line.key}`}
                  inputMode="decimal"
                  pattern="\d+(\.\d{1,2})?"
                  value={line.discountAmount}
                  onChange={(e) =>
                    updateLine(line.key, { discountAmount: e.target.value })
                  }
                />
              </Field>
              <Field label="Impuesto" htmlFor={`purchase-tax-${line.key}`}>
                <input
                  id={`purchase-tax-${line.key}`}
                  inputMode="decimal"
                  pattern="\d+(\.\d{1,2})?"
                  value={line.taxAmount}
                  onChange={(e) =>
                    updateLine(line.key, { taxAmount: e.target.value })
                  }
                />
              </Field>
              {lines.length > 1 ? (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() =>
                    setLines((current) =>
                      current.filter((item) => item.key !== line.key),
                    )
                  }
                >
                  Quitar línea
                </Button>
              ) : null}
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setLines((current) => [
                ...current,
                newLine(Math.max(...current.map((line) => line.key)) + 1),
              ])
            }
          >
            Agregar producto
          </Button>
        </fieldset>
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Guardar compra
          </Button>
        </div>
      </form>
    </div>
  );
}

type LifecycleAction = "confirm" | "cancel";

export function PurchaseDetailPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const [action, setAction] = useState<LifecycleAction | null>(null);
  const [receiptPage, setReceiptPage] = useState(1);
  const [returnPage, setReturnPage] = useState(1);
  const detail = useQuery({
    queryKey: queryKeys.purchase(id),
    queryFn: () => purchasingApi.purchase(id),
  });
  const receiptParams = { page: receiptPage, limit: 20 };
  const returnParams = { page: returnPage, limit: 20 };
  const receipts = useQuery({
    queryKey: queryKeys.receipts(id, receiptParams),
    queryFn: () => purchasingApi.receipts(id, receiptParams),
  });
  const returns = useQuery({
    queryKey: queryKeys.returns(id, returnParams),
    queryFn: () => purchasingApi.returns(id, returnParams),
  });
  const lifecycle = useMutation({
    mutationFn: (next: LifecycleAction) =>
      next === "confirm"
        ? purchasingApi.confirmPurchase(id)
        : purchasingApi.cancelPurchase(id),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.purchase(id) }),
        client.invalidateQueries({ queryKey: queryKeys.purchasesRoot }),
        client.invalidateQueries({ queryKey: queryKeys.payablesRoot }),
      ]);
      setAction(null);
    },
  });
  if (detail.isLoading) return <div className="panel">Cargando compra…</div>;
  if (!detail.data || detail.error)
    return (
      <FormFeedback
        error={
          detail.error ? apiErrorMessage(detail.error) : "Compra no encontrada."
        }
      />
    );
  const row = detail.data;
  const receiptColumns: ErpColumn<PurchaseReceipt>[] = [
    {
      key: "number",
      header: "Recepción",
      cell: (item) => (
        <Link className="table-link" to={`/app/purchasing/receipts/${item.id}`}>
          #{item.number}
        </Link>
      ),
    },
    {
      key: "location",
      header: "Destino",
      cell: (item) =>
        `${item.destinationLocation.code} · ${item.destinationLocation.name}`,
    },
    {
      key: "received",
      header: "Recibido",
      cell: (item) => formatDateTime(item.receivedAt),
    },
    {
      key: "status",
      header: "Estado",
      cell: (item) => <CommercialStatusBadge status={item.status} />,
    },
  ];
  const returnColumns: ErpColumn<PurchaseReturn>[] = [
    {
      key: "number",
      header: "Devolución",
      cell: (item) => (
        <Link className="table-link" to={`/app/purchasing/returns/${item.id}`}>
          #{item.number}
        </Link>
      ),
    },
    { key: "reason", header: "Motivo", cell: (item) => item.reason },
    {
      key: "created",
      header: "Creada",
      cell: (item) => formatDateTime(item.createdAt),
    },
    {
      key: "status",
      header: "Estado",
      cell: (item) => <CommercialStatusBadge status={item.status} />,
    },
  ];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Compra"
        title={`Compra #${row.number}`}
        description={`${row.supplier.code} · ${row.supplier.businessName}`}
        actions={
          <div className="row-actions">
            {row.status === "DRAFT" && hasPermission("purchases.update") ? (
              <Link
                className="button button--secondary"
                to={`/app/purchasing/purchases/${id}/edit`}
              >
                Editar
              </Link>
            ) : null}
            {row.status === "DRAFT" && hasPermission("purchases.update") ? (
              <Button onClick={() => setAction("confirm")}>Confirmar</Button>
            ) : null}
            {(["DRAFT", "CONFIRMED"] as PurchaseStatus[]).includes(
              row.status,
            ) && hasPermission("purchases.update") ? (
              <Button variant="danger" onClick={() => setAction("cancel")}>
                Cancelar
              </Button>
            ) : null}
            {(["CONFIRMED", "PARTIALLY_RECEIVED"] as PurchaseStatus[]).includes(
              row.status,
            ) && hasPermission("purchases.receive") ? (
              <Link
                className="button button--primary"
                to={`/app/purchasing/purchases/${id}/receipts`}
              >
                Recibir
              </Link>
            ) : null}
            {(["PARTIALLY_RECEIVED", "RECEIVED"] as PurchaseStatus[]).includes(
              row.status,
            ) && hasPermission("purchases.return") ? (
              <Link
                className="button button--secondary"
                to={`/app/purchasing/purchases/${id}/returns`}
              >
                Devolver
              </Link>
            ) : null}
            {(
              [
                "CONFIRMED",
                "PARTIALLY_RECEIVED",
                "RECEIVED",
              ] as PurchaseStatus[]
            ).includes(row.status) && hasPermission("purchases.pay") ? (
              <Link
                className="button button--secondary"
                to={`/app/purchasing/purchases/${id}/payments`}
              >
                Pagos
              </Link>
            ) : null}
          </div>
        }
      />
      <FormFeedback
        error={lifecycle.error ? apiErrorMessage(lifecycle.error) : null}
      />
      <section className="detail-grid">
        <article className="panel detail-card">
          <h2>Documento</h2>
          <dl>
            <div>
              <dt>Estado</dt>
              <dd>
                <CommercialStatusBadge status={row.status} />
              </dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>{formatCalendarDate(row.documentDate)}</dd>
            </div>
            <div>
              <dt>Vencimiento</dt>
              <dd>
                {row.paymentDueDate
                  ? formatCalendarDate(row.paymentDueDate)
                  : "Sin definir"}
              </dd>
            </div>
            <div>
              <dt>Documento proveedor</dt>
              <dd>{row.supplierDocumentNumber || "—"}</dd>
            </div>
            <div>
              <dt>Notas</dt>
              <dd>{row.notes || "—"}</dd>
            </div>
          </dl>
        </article>
        <article className="panel detail-card">
          <h2>Importes exactos</h2>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{formatMoney(row.subtotal)}</dd>
            </div>
            <div>
              <dt>Descuento</dt>
              <dd>{formatMoney(row.discountTotal)}</dd>
            </div>
            <div>
              <dt>Impuesto</dt>
              <dd>{formatMoney(row.taxTotal)}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>
                <strong>{formatMoney(row.total)}</strong>
              </dd>
            </div>
          </dl>
        </article>
      </section>
      {row.paymentSummary ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Liquidación financiera</h2>
              <p>Valores derivados por el backend.</p>
            </div>
            <CommercialStatusBadge
              status={row.paymentSummary.settlementStatus}
            />
          </div>
          <div className="commercial-summary-grid">
            <span>
              Compra bruta{" "}
              <strong>
                {formatMoney(row.paymentSummary.grossPurchaseValue)}
              </strong>
            </span>
            <span>
              Devoluciones{" "}
              <strong>
                {formatMoney(row.paymentSummary.purchaseReturnValue)}
              </strong>
            </span>
            <span>
              Obligación neta{" "}
              <strong>
                {formatMoney(row.paymentSummary.netPurchaseObligation)}
              </strong>
            </span>
            <span>
              Pagado activo{" "}
              <strong>{formatMoney(row.paymentSummary.netPaidAmount)}</strong>
            </span>
            <span>
              Pendiente{" "}
              <strong>
                {formatMoney(row.paymentSummary.outstandingAmount)}
              </strong>
            </span>
            <span>
              Crédito proveedor{" "}
              <strong>
                {formatMoney(row.paymentSummary.supplierCreditAmount)}
              </strong>
            </span>
          </div>
        </section>
      ) : null}
      <section className="panel">
        <h2>Líneas de compra</h2>
        <div className="table-scroll" tabIndex={0}>
          <table className="erp-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Ordenado</th>
                <th>Recibido</th>
                <th>Devuelto</th>
                <th>Pendiente recepción</th>
                <th>Costo</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(row.items ?? []).map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.product.code}</strong>
                    <small>{item.product.name}</small>
                  </td>
                  <td>{item.orderedQuantity}</td>
                  <td>{item.receivedQuantity}</td>
                  <td>{item.returnedQuantity}</td>
                  <td>{item.remainingReceivableQuantity}</td>
                  <td>{formatMoney(item.unitCost)}</td>
                  <td>{formatMoney(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Recepciones</h2>
            <p>Inventario cambia únicamente al publicar.</p>
          </div>
        </div>
        <ErpTable
          columns={receiptColumns}
          rows={receipts.data?.data}
          rowKey={(item) => item.id}
          loading={receipts.isLoading}
          error={receipts.error ? apiErrorMessage(receipts.error) : undefined}
          emptyTitle="Sin recepciones"
        />
        <Pagination meta={receipts.data?.meta} onPageChange={setReceiptPage} />
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Devoluciones a proveedor</h2>
            <p>
              Mercadería e importe financiero permanecen como operaciones
              separadas.
            </p>
          </div>
        </div>
        <ErpTable
          columns={returnColumns}
          rows={returns.data?.data}
          rowKey={(item) => item.id}
          loading={returns.isLoading}
          error={returns.error ? apiErrorMessage(returns.error) : undefined}
          emptyTitle="Sin devoluciones"
        />
        <Pagination meta={returns.data?.meta} onPageChange={setReturnPage} />
      </section>
      <ConfirmDialog
        open={Boolean(action)}
        title={action === "confirm" ? "Confirmar compra" : "Cancelar compra"}
        description={
          action === "confirm"
            ? "La compra avanzará a CONFIRMED. Esta acción no modifica Inventario."
            : "La compra se cancelará sin borrar su historial."
        }
        dangerous={action === "cancel"}
        loading={lifecycle.isPending}
        onCancel={() => setAction(null)}
        onConfirm={() => {
          if (action) lifecycle.mutate(action);
        }}
      />
    </div>
  );
}
