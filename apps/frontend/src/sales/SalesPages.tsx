import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { salesApi, type SaleInput } from "../api/sales-api";
import { useAuth } from "../auth/AuthContext";
import { Alert } from "../components/Alert";
import { BarcodeScanButton } from "../components/BarcodeScanButton";
import { Button } from "../components/Button";
import { CommercialStatusBadge } from "../components/CommercialStatusBadge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { ErpTable, type ErpColumn } from "../components/ErpTable";
import { LocationSelector, ProductSelector } from "../components/EntitySelectors";
import { Field } from "../components/Field";
import { FormFeedback } from "../components/FormFeedback";
import { OpenAccountsBar } from "../components/OpenAccountsBar";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { CustomerSelector } from "../components/SalesSelectors";
import { clearDraft, readDraft, useAutosaveDraft } from "../hooks/use-draft-autosave";
import { useFocusFieldById } from "../hooks/use-focus-field";
import { useKeyboardWedge } from "../hooks/use-keyboard-wedge";
import { useScanToProduct } from "../hooks/use-scan-to-product";
import { useUrlFilters } from "../hooks/use-url-filters";
import { queryKeys } from "../query/query-keys";
import {
  invalidateCommercialSummary,
  invalidateInventoryIntegration,
} from "../query/invalidation";
import type { Product } from "../types/erp";
import type { Sale, SaleReturn, SaleStatus } from "../types/sales";
import { apiErrorMessage } from "../utils/api-error";
import {
  formatCalendarDate,
  formatDateTime,
  formatMoney,
} from "../utils/formatters";

const statuses: SaleStatus[] = ["DRAFT", "POSTED", "CANCELLED"];
const today = () => new Date().toISOString().slice(0, 10);

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

/** How the counter identifies who a Sale is for. */
type SaleMode = "mostrador" | "cuenta" | "cliente";

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

type Line = {
  key: number;
  productId: string;
  /** Snapshot of the product's code/name, so each table row can show it
   * without a per-line search widget once the product is already chosen. */
  productCode: string;
  productName: string;
  sourceLocationId: string;
  /** Display label ("BOD-01 · Bodega principal") for the collapsed summary. */
  sourceLocationLabel: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxAmount: string;
};
const newLine = (
  key: number,
  sourceLocationId = "",
  sourceLocationLabel = "",
): Line => ({
  key,
  productId: "",
  productCode: "",
  productName: "",
  sourceLocationId,
  sourceLocationLabel,
  quantity: "1",
  unitPrice: "",
  discountAmount: "0.00",
  taxAmount: "0.00",
});

/** Line total: quantity × unit price, minus the discount, plus the tax. */
function lineTotal(line: Pick<Line, "quantity" | "unitPrice" | "discountAmount" | "taxAmount">): number {
  const qty = Number(line.quantity) || 0;
  const price = Number(line.unitPrice) || 0;
  const discount = Number(line.discountAmount) || 0;
  const tax = Number(line.taxAmount) || 0;
  return qty * price - discount + tax;
}

/**
 * Most sales pull every line from the same shelf. Default a new line to
 * whichever location the last one used, so "Ubicación origen" is rarely
 * something the vendor has to touch while scanning.
 */
function lastUsedLocation(lines: Line[]): Pick<
  Line,
  "sourceLocationId" | "sourceLocationLabel"
> {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].sourceLocationId)
      return {
        sourceLocationId: lines[i].sourceLocationId,
        sourceLocationLabel: lines[i].sourceLocationLabel,
      };
  }
  return { sourceLocationId: "", sourceLocationLabel: "" };
}

function hasMoneyAdjustment(line: Line): boolean {
  const isZero = (value: string) => !value || Number(value) === 0;
  return !isZero(line.discountAmount) || !isZero(line.taxAmount);
}

/** Everything the form autosaves locally so a crash mid-scan isn't a loss. */
interface SaleDraftData {
  mode: SaleMode;
  customerId: string;
  accountLabel: string;
  documentDate: string;
  paymentDueDate: string;
  notes: string;
  lines: Line[];
}

export function SaleFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const detail = useQuery({
    queryKey: queryKeys.sale(id ?? "new"),
    queryFn: () => salesApi.detail(id!),
    enabled: Boolean(id),
  });
  if (id && detail.isLoading)
    return <div className="panel">Cargando venta…</div>;
  if (id && detail.error)
    return <FormFeedback error={apiErrorMessage(detail.error)} />;
  if (id && detail.data?.status !== "DRAFT")
    return <FormFeedback error="Solo las ventas DRAFT pueden editarse." />;
  return (
    <SaleEditor
      // Force a full remount on navigation between sales (e.g. switching
      // open-account tabs): React Router reuses this component instance
      // across `:id` changes on the same route, so without a key the local
      // form state from the previous sale would stick around.
      key={`${id ?? "new"}:${searchParams.get("mode") ?? ""}:${searchParams.get("customerId") ?? ""}`}
      id={id}
      initial={detail.data}
      requestedMode={searchParams.get("mode") === "cuenta" ? "cuenta" : undefined}
      requestedCustomerId={searchParams.get("customerId") ?? undefined}
    />
  );
}

function SaleEditor({
  id,
  initial,
  requestedMode,
  requestedCustomerId,
}: {
  id?: string;
  initial?: Sale;
  requestedMode?: SaleMode;
  requestedCustomerId?: string;
}) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [mode, setMode] = useState<SaleMode>(() => {
    if (initial?.accountLabel) return "cuenta";
    if (initial?.customerId) return "cliente";
    if (!id && requestedCustomerId) return "cliente";
    return requestedMode ?? "mostrador";
  });
  const [customerId, setCustomerId] = useState(
    initial?.customerId ?? (!id ? (requestedCustomerId ?? "") : ""),
  );
  const [accountLabel, setAccountLabel] = useState(initial?.accountLabel ?? "");
  const [documentDate, setDocumentDate] = useState(
    initial?.documentDate.slice(0, 10) ?? today(),
  );
  const [paymentDueDate, setPaymentDueDate] = useState(
    initial?.paymentDueDate?.slice(0, 10) ?? "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(() =>
    initial
      ? (initial.items ?? []).map((item, index) => ({
          key: index + 1,
          productId: item.productId,
          productCode: item.product.code,
          productName: item.product.name,
          sourceLocationId: item.sourceLocationId,
          sourceLocationLabel: item.sourceLocation
            ? `${item.sourceLocation.code} · ${item.sourceLocation.name}`
            : "",
          quantity: String(item.quantity),
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          taxAmount: item.taxAmount,
        }))
      : [],
  );
  const [formError, setFormError] = useState<string | null>(null);
  const duplicate = useMemo(() => {
    const keys = lines
      .filter((line) => line.productId && line.sourceLocationId)
      .map((line) => `${line.productId}:${line.sourceLocationId}`);
    return new Set(keys).size !== keys.length;
  }, [lines]);

  // Local recovery net: while this sale is being edited, keep saving it to
  // this browser so a crash or an accidentally closed tab doesn't lose a
  // half-scanned account. Not a sync mechanism — just a safety net.
  const draftKey = `sale-draft:${id ? `edit:${id}` : "new"}`;
  const [restorableDraft] = useState(() => readDraft<SaleDraftData>(draftKey));
  const [draftResolved, setDraftResolved] = useState(!restorableDraft);
  function restoreDraft() {
    if (!restorableDraft) return;
    const d = restorableDraft.data;
    setMode(d.mode);
    setCustomerId(d.customerId);
    setAccountLabel(d.accountLabel);
    setDocumentDate(d.documentDate);
    setPaymentDueDate(d.paymentDueDate);
    setNotes(d.notes);
    setLines(d.lines);
    setDraftResolved(true);
  }
  function discardDraft() {
    clearDraft(draftKey);
    setDraftResolved(true);
  }
  const cancelAutosave = useAutosaveDraft(
    draftKey,
    { mode, customerId, accountLabel, documentDate, paymentDueDate, notes, lines },
    draftResolved,
  );

  const mutation = useMutation({
    mutationFn: (body: SaleInput) =>
      id ? salesApi.update(id, body) : salesApi.create(body),
    onSuccess: async (sale) => {
      client.setQueryData(queryKeys.sale(sale.id), sale);
      await client.invalidateQueries({ queryKey: queryKeys.salesRoot });
      cancelAutosave();
      clearDraft(draftKey);
      // Mostrador/cliente: off to the detail page to collect payment. Cuenta:
      // stay in the editor — the vendor is very likely about to keep adding
      // pieces to this vehicle, or hop to another open account's tab.
      void navigate(
        mode === "cuenta" ? `/app/sales/${sale.id}/edit` : `/app/sales/${sale.id}`,
        { replace: true },
      );
    },
  });
  // After a product lands on a line (scanned or picked), the cursor jumps
  // straight to that line's Cantidad — ready to type a quantity, or just to
  // keep scanning if the physical reader's next code lands globally anyway.
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  useFocusFieldById(focusTarget);

  const updateLine = (key: number, changes: Partial<Line>) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...changes } : line)),
    );
  const addScannedProduct = useCallback((product: Product) => {
    let targetKey = 0;
    setLines((current) => {
      const price = product.defaultSalePrice ?? "";
      // Scanning (or picking) the same product again just bumps its
      // quantity by one instead of adding a second row for it — the table
      // stays one row per product, the way a vendor scanning several units
      // of the same part expects.
      const existingIndex = current.findIndex(
        (line) => line.productId === product.id,
      );
      if (existingIndex >= 0) {
        targetKey = current[existingIndex].key;
        return current.map((line, index) =>
          index === existingIndex
            ? { ...line, quantity: String((Number(line.quantity) || 0) + 1) }
            : line,
        );
      }
      const nextKey = current.length
        ? Math.max(...current.map((line) => line.key)) + 1
        : 1;
      targetKey = nextKey;
      const location = lastUsedLocation(current);
      return [
        ...current,
        {
          ...newLine(
            nextKey,
            location.sourceLocationId,
            location.sourceLocationLabel,
          ),
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          unitPrice: price,
        },
      ];
    });
    setFocusTarget(`sale-qty-${targetKey}`);
  }, []);
  const { handleScan, feedback: scanFeedback } =
    useScanToProduct(addScannedProduct);
  useKeyboardWedge(handleScan);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (lines.length === 0) {
      setFormError("Agregá al menos un producto antes de guardar.");
      return;
    }
    if (lines.some((line) => !line.sourceLocationId)) {
      setFormError("Elegí la ubicación de origen de cada producto.");
      return;
    }
    if (lines.some((line) => !line.unitPrice)) {
      setFormError("Elegí el precio unitario de cada producto.");
      return;
    }
    if (duplicate) {
      setFormError(
        "Una combinación de producto y ubicación solo puede aparecer una vez.",
      );
      return;
    }
    if (mode === "cuenta" && !accountLabel.trim()) {
      setFormError(
        "Ponle una etiqueta a la cuenta para poder distinguirla (por ejemplo «Corolla azul – Juan»).",
      );
      return;
    }
    setFormError(null);
    mutation.mutate({
      customerId: mode === "mostrador" ? null : customerId || null,
      accountLabel:
        mode === "cuenta" ? accountLabel.trim() : id ? "" : undefined,
      documentDate,
      paymentDueDate:
        mode === "mostrador" ? undefined : paymentDueDate || undefined,
      notes: notes || undefined,
      items: lines.map((line) => ({
        productId: line.productId,
        sourceLocationId: line.sourceLocationId,
        quantity: Number(line.quantity),
        unitPrice: line.unitPrice || undefined,
        discountAmount: line.discountAmount || undefined,
        taxAmount: line.taxAmount || undefined,
      })),
    });
  }

  const modeTitle =
    mode === "cuenta"
      ? id
        ? "Editar cuenta"
        : "Abrir cuenta"
      : id
        ? "Editar venta"
        : "Nueva venta";

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Vender"
        title={modeTitle}
        description="Al guardar queda como borrador y todavía no toca el inventario. El inventario se descuenta cuando confirmás la venta."
      />
      {mode === "cuenta" ? <OpenAccountsBar activeSaleId={id} /> : null}
      {!draftResolved && restorableDraft ? (
        <Alert tone="warning" title="Hay cambios sin guardar de antes">
          <p>
            Parece que se cerró la pestaña o hubo un corte antes de guardar.
            Podés seguir con lo que tenías o descartarlo.
          </p>
          <div className="dialog-actions">
            <Button type="button" variant="secondary" onClick={discardDraft}>
              Descartar
            </Button>
            <Button type="button" onClick={restoreDraft}>
              Restaurar
            </Button>
          </div>
        </Alert>
      ) : null}
      <form className="panel erp-form" onSubmit={submit}>
        <FormFeedback
          error={formError ?? (mutation.error ? apiErrorMessage(mutation.error) : null)}
        />

        <fieldset className="form-section">
          <legend>¿Cómo es esta venta?</legend>
          <div className="mode-select" role="radiogroup" aria-label="Tipo de venta">
            {(
              [
                [
                  "mostrador",
                  "Venta rápida (mostrador)",
                  "El cliente paga y se lleva la pieza ahora. No hace falta registrarlo.",
                ],
                [
                  "cliente",
                  "A un cliente registrado",
                  "Para alguien de tu directorio. Podés dejarla a crédito y cobrarla después.",
                ],
                [
                  "cuenta",
                  "Cuenta abierta",
                  "Se le van sumando piezas durante el día o el trabajo y se cierra al final. Le ponés un nombre para reconocerla.",
                ],
              ] as Array<[SaleMode, string, string]>
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={`mode-select__option ${mode === value ? "mode-select__option--active" : ""}`}
              >
                <input
                  type="radio"
                  name="sale-mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                />
                <span>
                  <strong>{label}</strong>
                  <small>{hint}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="form-grid">
          {mode === "cuenta" ? (
            <Field
              label="Etiqueta de la cuenta"
              htmlFor="sale-account-label"
              required
              hint="Cómo la reconoces en el mostrador: vehículo, apodo, color… Ej. «Corolla azul – Juan»."
            >
              <input
                id="sale-account-label"
                required
                maxLength={120}
                placeholder="Corolla azul – Juan"
                value={accountLabel}
                onChange={(e) => setAccountLabel(e.target.value)}
              />
            </Field>
          ) : null}

          {mode === "cliente" ? (
            <CustomerSelector
              id="sale-customer"
              label="Cliente"
              value={customerId}
              onChange={setCustomerId}
            />
          ) : null}

          <Field label="Fecha del documento" htmlFor="sale-date" required>
            <input
              id="sale-date"
              type="date"
              required
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
            />
          </Field>

          {mode !== "mostrador" ? (
            <Field
              label="Fecha de vencimiento"
              htmlFor="sale-due"
              hint="Opcional. Si la venta queda a crédito, esta fecha marca cuándo vence en Cuentas por Cobrar."
            >
              <input
                id="sale-due"
                type="date"
                value={paymentDueDate}
                onChange={(e) => setPaymentDueDate(e.target.value)}
              />
            </Field>
          ) : null}

          <Field label="Notas" htmlFor="sale-notes">
            <textarea
              id="sale-notes"
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>

        {mode === "mostrador" ? (
          <p className="muted">
            ¿Es para un cliente que ya tenés registrado? Elegí «A un cliente
            registrado» arriba. El cobro se registra después, con el botón
            «Cobrar» de la venta.
          </p>
        ) : null}

        {mode === "cuenta" ? (
          <details className="filter-details">
            <summary>Asociar un cliente registrado (opcional)</summary>
            <div className="form-grid">
              <CustomerSelector
                id="sale-account-customer"
                label="Cliente"
                value={customerId}
                onChange={setCustomerId}
              />
            </div>
          </details>
        ) : null}

        <fieldset className="form-section purchase-lines">
          <legend>Productos</legend>
          <p>
            Escaneá el código o buscalo abajo para sumarlo a la tabla — un
            producto ya conocido no vuelve a pedir ubicación ni costo, solo
            cantidad y, si hace falta, el precio.
          </p>
          <div className="scan-row">
            <BarcodeScanButton
              label="Escanear producto"
              title="Escanear producto para la venta"
              onScan={handleScan}
            />
            <span className="muted">
              o dispara un lector físico USB/Bluetooth: se agrega el producto a
              la venta.
            </span>
            {scanFeedback ? (
              <span
                className={`scan-row__feedback scan-row__feedback--${scanFeedback.tone}`}
              >
                {scanFeedback.text}
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
                    <th>Precio unitario</th>
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
                        <details
                          className="line-location"
                          open={!line.sourceLocationId}
                        >
                          <summary>
                            {line.sourceLocationLabel ||
                              (line.sourceLocationId
                                ? "Ubicación elegida"
                                : "Elegí la ubicación")}
                          </summary>
                          <LocationSelector
                            id={`sale-location-${line.key}`}
                            label="Ubicación origen"
                            required
                            value={line.sourceLocationId}
                            onChange={(sourceLocationId, item) =>
                              updateLine(line.key, {
                                sourceLocationId,
                                sourceLocationLabel: item
                                  ? `${item.code} · ${item.name}`
                                  : "",
                              })
                            }
                          />
                        </details>
                      </td>
                      <td>
                        <Field
                          label="Cantidad"
                          htmlFor={`sale-qty-${line.key}`}
                          required
                        >
                          <input
                            id={`sale-qty-${line.key}`}
                            className="line-qty-input"
                            required
                            type="number"
                            min={1}
                            step={1}
                            value={line.quantity}
                            onChange={(e) =>
                              updateLine(line.key, { quantity: e.target.value })
                            }
                          />
                        </Field>
                      </td>
                      <td>
                        <Field
                          label="Precio unitario"
                          htmlFor={`sale-price-${line.key}`}
                          required
                        >
                          <input
                            id={`sale-price-${line.key}`}
                            className="line-price-input"
                            required
                            inputMode="decimal"
                            pattern="\d+(\.\d{1,4})?"
                            value={line.unitPrice}
                            onChange={(e) =>
                              updateLine(line.key, { unitPrice: e.target.value })
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
                              htmlFor={`sale-discount-${line.key}`}
                            >
                              <input
                                id={`sale-discount-${line.key}`}
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
                            <Field label="Impuesto" htmlFor={`sale-tax-${line.key}`}>
                              <input
                                id={`sale-tax-${line.key}`}
                                inputMode="decimal"
                                pattern="\d+(\.\d{1,2})?"
                                value={line.taxAmount}
                                onChange={(e) =>
                                  updateLine(line.key, { taxAmount: e.target.value })
                                }
                              />
                            </Field>
                          </div>
                        </details>
                      </td>
                      <td className="line-total">
                        {formatMoney(lineTotal(line).toFixed(4))}
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
                        lines.reduce((sum, line) => sum + lineTotal(line), 0).toFixed(4),
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
              id="sale-add-product"
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
            {mode === "cuenta" ? "Guardar cuenta" : "Guardar venta"}
          </Button>
        </div>
      </form>
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
  const returnParams = { page: returnPage, limit: 20 };
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
                to={`/app/sales/${id}/edit`}
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
