import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { purchasingApi, type PurchaseInput } from "../api/purchasing-api";
import { useAuth } from "../auth/AuthContext";
import { BarcodeScanButton } from "../components/BarcodeScanButton";
import { Button } from "../components/Button";
import { CommercialStatusBadge } from "../components/CommercialStatusBadge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { ErpTable, type ErpColumn } from "../components/ErpTable";
import { Field } from "../components/Field";
import { FormFeedback } from "../components/FormFeedback";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { ProductSelector } from "../components/EntitySelectors";
import { SupplierSelector } from "../components/PurchasingSelectors";
import { useFocusFieldById } from "../hooks/use-focus-field";
import { useKeyboardWedge } from "../hooks/use-keyboard-wedge";
import { useScanToProduct } from "../hooks/use-scan-to-product";
import { useUrlFilters } from "../hooks/use-url-filters";
import { PurchaseAttachmentManager } from "./PurchaseAttachmentManager";
import { PurchaseChain, purchaseStep } from "./PurchaseChain";
import { queryKeys } from "../query/query-keys";
import { invalidateCommercialSummary } from "../query/invalidation";
import type { Product } from "../types/erp";
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
const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  DRAFT: "Borrador (sin confirmar)",
  CONFIRMED: "Confirmada (falta recibir)",
  PARTIALLY_RECEIVED: "Recibida en parte",
  RECEIVED: "Recibida completa",
  CANCELLED: "Cancelada",
};

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
            {row.supplierDocumentNumber
              ? `Factura ${row.supplierDocumentNumber}`
              : "Sin número de factura"}
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
        eyebrow="Comprar"
        title="Compras"
        description="Cada compra es una factura o remisión de un proveedor. La registrás, la confirmás, marcás la mercadería como recibida y la pagás."
        actions={
          hasPermission("purchases.create") ? (
            <Link
              className="button button--primary"
              to="/app/purchasing/purchases/new"
            >
              Registrar una factura
            </Link>
          ) : undefined
        }
      />
      <PurchaseChain />
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
            <option value="">Cualquier estado</option>
            {purchaseStatuses.map((status) => (
              <option key={status} value={status}>
                {PURCHASE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Número de compra" htmlFor="purchase-number-filter">
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
            Limpiar filtros
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
          emptyState={
            <EmptyState
              title="Todavía no registraste compras"
              action={
                hasPermission("purchases.create") ? (
                  <Link
                    className="button button--primary"
                    to="/app/purchasing/purchases/new"
                  >
                    Registrar la primera factura
                  </Link>
                ) : undefined
              }
            >
              Cuando te llegue una factura de un proveedor, registrala acá con
              su número, la fecha y los productos que trae.
            </EmptyState>
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

const today = () => new Date().toISOString().slice(0, 10);

type PurchaseLineForm = {
  key: number;
  productId: string;
  /** Snapshot of the product's code/name, shown directly in the table row
   * instead of a per-line search widget once the product is already chosen. */
  productCode: string;
  productName: string;
  orderedQuantity: string;
  unitCost: string;
  discountAmount: string;
  taxAmount: string;
};
function hasMoneyAdjustment(line: PurchaseLineForm): boolean {
  const isZero = (value: string) => !value || Number(value) === 0;
  return !isZero(line.discountAmount) || !isZero(line.taxAmount);
}

/** Line total: quantity × unit cost, minus the discount, plus the tax. */
function purchaseLineTotal(
  line: Pick<PurchaseLineForm, "orderedQuantity" | "unitCost" | "discountAmount" | "taxAmount">,
): number {
  const qty = Number(line.orderedQuantity) || 0;
  const cost = Number(line.unitCost) || 0;
  const discount = Number(line.discountAmount) || 0;
  const tax = Number(line.taxAmount) || 0;
  return qty * cost - discount + tax;
}

const newLine = (key: number): PurchaseLineForm => ({
  key,
  productId: "",
  productCode: "",
  productName: "",
  orderedQuantity: "1",
  unitCost: "",
  discountAmount: "0.00",
  taxAmount: "0.00",
});

export function PurchaseFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
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
  return (
    <PurchaseFormEditor
      id={id}
      initial={detail.data}
      requestedSupplierId={
        id ? undefined : (searchParams.get("supplierId") ?? undefined)
      }
    />
  );
}

function PurchaseFormEditor({
  id,
  initial,
  requestedSupplierId,
}: {
  id?: string;
  initial?: Purchase;
  requestedSupplierId?: string;
}) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [supplierId, setSupplierId] = useState(
    initial?.supplierId ?? requestedSupplierId ?? "",
  );
  const [supplierDocumentNumber, setSupplierDocumentNumber] = useState(
    initial?.supplierDocumentNumber ?? "",
  );
  const [documentDate, setDocumentDate] = useState(
    initial?.documentDate.slice(0, 10) ?? today(),
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
          productCode: item.product.code,
          productName: item.product.name,
          orderedQuantity: String(item.orderedQuantity),
          unitCost: item.unitCost,
          discountAmount: item.discountAmount,
          taxAmount: item.taxAmount,
        }))
      : [],
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

  // After a product lands on a line (scanned or picked), the cursor jumps
  // straight to Cantidad — ready to type, or to keep scanning the next one.
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  useFocusFieldById(focusTarget);

  const addScannedProduct = useCallback((product: Product) => {
    let targetKey = 0;
    setLines((current) => {
      // Scanning the same product again just bumps its quantity by one
      // instead of a second row — the table stays one row per product.
      const existingIndex = current.findIndex(
        (line) => line.productId === product.id,
      );
      if (existingIndex >= 0) {
        targetKey = current[existingIndex].key;
        return current.map((line, index) =>
          index === existingIndex
            ? {
                ...line,
                orderedQuantity: String(
                  (Number(line.orderedQuantity) || 0) + 1,
                ),
              }
            : line,
        );
      }
      // Purchase cost is real money paid this time, not authoritative — but
      // the reference cost is a fair starting point so the field can stay
      // collapsed instead of demanding a value with nothing to go on.
      const cost = product.referenceCost ?? "";
      const nextKey = current.length
        ? Math.max(...current.map((line) => line.key)) + 1
        : 1;
      targetKey = nextKey;
      return [
        ...current,
        {
          ...newLine(nextKey),
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          unitCost: cost,
        },
      ];
    });
    setFocusTarget(`purchase-quantity-${targetKey}`);
  }, []);
  const { handleScan, feedback: scanFeedback } = useScanToProduct(
    addScannedProduct,
    { allowNew: true },
  );
  useKeyboardWedge(handleScan);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (lines.length === 0) {
      setFormError("Agregá al menos un producto antes de guardar.");
      return;
    }
    if (lines.some((line) => !line.unitCost)) {
      setFormError("Elegí el costo unitario de cada producto.");
      return;
    }
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
        eyebrow="Comprar"
        title={id ? "Editar la factura" : "Registrar una factura de proveedor"}
        description="Cargá acá la factura o remisión que te manda el proveedor: su número, la fecha y los productos que trae con su costo. Todavía no entra al inventario — eso pasa cuando marcás la mercadería como recibida."
      />
      <PurchaseChain current="register" purchaseId={id} />
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
          <Field
            label="Número de la factura o remisión"
            htmlFor="purchase-document"
            hint="El que trae impreso el documento del proveedor. El PDF o la foto se adjuntan desde la ficha de la compra, después de guardarla."
          >
            <input
              id="purchase-document"
              maxLength={80}
              placeholder="Ej. FAC-004521"
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
          <legend>Productos que trae la factura</legend>
          <p>
            Escaneá el código o buscalo abajo para sumarlo a la tabla, con la
            cantidad y el costo que figura en la factura. Un producto ya
            conocido trae su costo de referencia solo; el total lo calcula el
            sistema al guardar.
          </p>
          <div className="scan-row">
            <BarcodeScanButton
              label="Escanear producto"
              title="Escanear producto para la compra"
              onScan={handleScan}
            />
            <span className="muted">
              o dispara un lector físico USB/Bluetooth: se agrega el producto a
              la compra.
            </span>
            {scanFeedback ? (
              <span
                className={`scan-row__feedback scan-row__feedback--${scanFeedback.tone}`}
              >
                {scanFeedback.text}
                {scanFeedback.tone === "new" ? (
                  <Link
                    className="table-link"
                    to={`/app/catalog/products/new?code=${encodeURIComponent(scanFeedback.code ?? "")}`}
                  >
                    {" "}
                    Registrar producto nuevo →
                  </Link>
                ) : null}
              </span>
            ) : null}
          </div>
          {lines.length ? (
            <div className="table-wrap line-items-table-wrap">
              <table className="line-items-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Costo unitario</th>
                    <th>Total</th>
                    <th aria-label="Quitar" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.key}>
                      <td className="line-product">
                        <strong>{line.productCode}</strong>
                        <small>{line.productName}</small>
                      </td>
                      <td>
                        <Field
                          label="Cantidad"
                          htmlFor={`purchase-quantity-${line.key}`}
                          required
                        >
                          <input
                            id={`purchase-quantity-${line.key}`}
                            className="line-qty-input"
                            required
                            type="number"
                            min={1}
                            step={1}
                            value={line.orderedQuantity}
                            onChange={(e) =>
                              updateLine(line.key, {
                                orderedQuantity: e.target.value,
                              })
                            }
                          />
                        </Field>
                      </td>
                      <td>
                        <Field
                          label="Costo unitario"
                          htmlFor={`purchase-cost-${line.key}`}
                          required
                        >
                          <input
                            id={`purchase-cost-${line.key}`}
                            className="line-price-input"
                            required
                            inputMode="decimal"
                            pattern="\d+(\.\d{1,4})?"
                            value={line.unitCost}
                            onChange={(e) =>
                              updateLine(line.key, { unitCost: e.target.value })
                            }
                          />
                        </Field>
                        <details
                          className="line-more"
                          open={hasMoneyAdjustment(line)}
                        >
                          <summary>Descuento / impuesto</summary>
                          <div className="line-more__fields">
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
                                  updateLine(line.key, {
                                    discountAmount: e.target.value,
                                  })
                                }
                              />
                            </Field>
                            <Field
                              label="Impuesto"
                              htmlFor={`purchase-tax-${line.key}`}
                            >
                              <input
                                id={`purchase-tax-${line.key}`}
                                inputMode="decimal"
                                pattern="\d+(\.\d{1,2})?"
                                value={line.taxAmount}
                                onChange={(e) =>
                                  updateLine(line.key, {
                                    taxAmount: e.target.value,
                                  })
                                }
                              />
                            </Field>
                          </div>
                        </details>
                      </td>
                      <td className="line-total">
                        {formatMoney(purchaseLineTotal(line).toFixed(4))}
                      </td>
                      <td>
                        <Button
                          type="button"
                          variant="danger"
                          className="line-remove"
                          onClick={() =>
                            setLines((current) =>
                              current.filter((item) => item.key !== line.key),
                            )
                          }
                        >
                          Quitar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total</td>
                    <td className="line-total">
                      {formatMoney(
                        lines
                          .reduce((sum, line) => sum + purchaseLineTotal(line), 0)
                          .toFixed(4),
                      )}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="line-empty">Todavía no agregaste ningún producto.</p>
          )}
          <div className="line-add">
            <ProductSelector
              id="purchase-add-product"
              label="Agregar producto"
              value=""
              onChange={(_productId, item?: Product) => {
                if (item) addScannedProduct(item);
              }}
            />
          </div>
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
  const receiptParams = { page: receiptPage, limit: 10 };
  const returnParams = { page: returnPage, limit: 10 };
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
        client.invalidateQueries({ queryKey: queryKeys.supplierAccountsRoot }),
        invalidateCommercialSummary(client),
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
        eyebrow="Comprar"
        title={`Compra #${row.number}`}
        description={
          row.supplierDocumentNumber
            ? `${row.supplier.businessName} · Factura ${row.supplierDocumentNumber}`
            : `${row.supplier.businessName} · sin número de factura`
        }
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
                Recibir mercadería
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
                Pagar
              </Link>
            ) : null}
          </div>
        }
      />
      {purchaseStep(row.status) ? (
        <PurchaseChain current={purchaseStep(row.status)!} purchaseId={id} />
      ) : null}
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
          <h2>Importes</h2>
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
      <PurchaseAttachmentManager
        purchaseId={id}
        canEdit={hasPermission("purchases.update")}
      />
      {row.paymentSummary ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Cuánto se le debe al proveedor</h2>
              <p>Lo calcula el sistema a partir de la factura, las recepciones y los pagos.</p>
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
        <h2>Productos de la factura</h2>
        <div className="table-scroll" tabIndex={0}>
          <table className="erp-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>En la factura</th>
                <th>Recibido</th>
                <th>Devuelto</th>
                <th>Falta recibir</th>
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
            <p>El inventario sube cuando confirmás cada recepción, no antes.</p>
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
            <h2>Devoluciones al proveedor</h2>
            <p>Si le devolvés mercadería al proveedor, se registra acá. El ajuste del dinero es aparte.</p>
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
            ? "La compra queda confirmada. Todavía no toca el inventario: eso pasa al recibir la mercadería."
            : "La compra se cancela. Su historial se conserva."
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
