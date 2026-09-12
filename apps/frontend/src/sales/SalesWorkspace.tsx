import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { salesApi, type SaleInput } from "../api/sales-api";
import { salesFinanceApi } from "../api/sales-finance-api";
import { useAuth } from "../auth/AuthContext";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { FormFeedback } from "../components/FormFeedback";
import { Field } from "../components/Field";
import { OpenAccountsBar } from "../components/OpenAccountsBar";
import { PageHeader } from "../components/PageHeader";
import { CustomerSelector } from "../components/SalesSelectors";
import { TabBar, TabPanel } from "../components/WorkspaceTabs";
import { clearDraft, readDraft, useAutosaveDraft } from "../hooks/use-draft-autosave";
import { queryKeys } from "../query/query-keys";
import {
  invalidateCashIntegration,
  invalidateInventoryIntegration,
} from "../query/invalidation";
import type { Sale } from "../types/sales";
import { apiErrorMessage } from "../utils/api-error";
import { formatMoney, isMoneyAtLeast } from "../utils/formatters";
import { useSalePaymentFields, SalePaymentFieldset } from "./SalePaymentFields";
import {
  linesTotal,
  useSaleLineItems,
  ProductLinesEditor,
  type Line,
} from "./SaleLineItems";

const today = () => new Date().toISOString().slice(0, 10);

function lineItems(lines: Line[]): SaleInput["items"] {
  return lines.map((line) => ({
    productId: line.productId,
    sourceLocationId: line.sourceLocationId,
    quantity: Number(line.quantity),
    unitPrice: line.unitPrice || undefined,
    discountAmount: line.discountAmount || undefined,
    taxAmount: line.taxAmount || undefined,
  }));
}

function validateLines(lines: Line[]): string | null {
  if (lines.length === 0) return "Agregá al menos un producto.";
  if (lines.some((line) => !line.sourceLocationId))
    return "Elegí la ubicación de origen de cada producto.";
  if (lines.some((line) => !line.unitPrice))
    return "Elegí el precio unitario de cada producto.";
  return null;
}

type PanelKind = "mostrador" | "cliente" | "cuenta";

const WORKSPACE_TABS: { key: PanelKind; label: string }[] = [
  { key: "mostrador", label: "Venta rápida" },
  { key: "cliente", label: "Cliente registrado" },
  { key: "cuenta", label: "Cuentas abiertas" },
];

/**
 * Legacy route (`/app/sales/:id/edit`) kept working for any old link/bookmark:
 * it just resolves which workspace column owns that DRAFT sale and hands off
 * to the query-param form the three-column workspace actually reads.
 */
export function SaleEditRedirect() {
  const { id = "" } = useParams();
  const detail = useQuery({
    queryKey: queryKeys.sale(id),
    queryFn: () => salesApi.detail(id),
  });
  if (detail.isLoading) return <div className="panel">Cargando venta…</div>;
  if (detail.error || !detail.data)
    return <FormFeedback error={apiErrorMessage(detail.error)} />;
  const target = detail.data.accountLabel
    ? `/app/sales/new?account=${id}`
    : `/app/sales/new?customerSale=${id}`;
  return <Navigate to={target} replace />;
}

/**
 * Ventas: three independent panels instead of one form with a mode selector.
 * Each panel is its own draft with its own state — loading a product into
 * one never touches the others, which is what used to cause a product
 * picked under one sale type to still be sitting in the table after
 * switching to another (the state simply doesn't exist anywhere shared
 * anymore, there's nothing left to leak).
 *
 * All three stay mounted at all times — a tab bar only controls which one is
 * visible (via the `hidden` attribute), not which ones exist. Switching tabs
 * is purely a view change: nothing unmounts, so nothing resets.
 */
export function SaleFormPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const accountId = searchParams.get("account") ?? undefined;
  const customerSaleId = searchParams.get("customerSale") ?? undefined;
  const presetCustomerId = searchParams.get("customerId") ?? undefined;
  const initialFocus: PanelKind = searchParams.get("mode") === "cuenta"
    ? "cuenta"
    : customerSaleId || presetCustomerId
      ? "cliente"
      : "mostrador";
  const [activePanel, setActivePanel] = useState<PanelKind>(initialFocus);

  function setAccountId(id?: string) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (id) next.set("account", id);
        else next.delete("account");
        return next;
      },
      { replace: true },
    );
  }

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Vender" title="Ventas" />
      <TabBar
        idPrefix="sales"
        ariaLabel="Modalidad de venta"
        tabs={WORKSPACE_TABS}
        activeKey={activePanel}
        onChange={setActivePanel}
      />
      <div className="workspace-tab-content">
        <TabPanel idPrefix="sales" tabKey="mostrador" activeKey={activePanel}>
          <QuickSalePanel active={activePanel === "mostrador"} />
        </TabPanel>
        <TabPanel idPrefix="sales" tabKey="cliente" activeKey={activePanel}>
          <CustomerSalePanel
            key={customerSaleId ?? "new"}
            resumeId={customerSaleId}
            presetCustomerId={presetCustomerId}
            active={activePanel === "cliente"}
          />
        </TabPanel>
        <TabPanel idPrefix="sales" tabKey="cuenta" activeKey={activePanel}>
          <OpenAccountColumn
            focusedId={accountId}
            onFocusedIdChange={setAccountId}
            active={activePanel === "cuenta"}
          />
        </TabPanel>
      </div>
    </div>
  );
}

/**
 * Left column: a walk-in sale, "el cliente paga y se lleva la pieza ahora".
 * One button does what used to be Guardar → Confirmar → Cobrar as three
 * separate screens: create the sale, confirm it, and register the payment,
 * with the amount pre-filled from the table's own total.
 */
class PartialCheckoutError extends Error {
  constructor(
    readonly saleId: string,
    readonly stage: "post" | "payment",
  ) {
    super(`checkout failed at ${stage}`);
  }
}

function QuickSalePanel({ active }: { active: boolean }) {
  const client = useQueryClient();
  const { hasPermission } = useAuth();
  const canCheckoutInOneStep =
    hasPermission("sales.create") &&
    hasPermission("sales.post") &&
    hasPermission("payments.create");

  const { lines, updateLine, removeLine, addScannedProduct, handleScan, scanFeedback, duplicate, setLines } =
    useSaleLineItems("mostrador", undefined, active);
  const total = linesTotal(lines);
  const suggestedAmount = total > 0 ? total.toFixed(2) : "";
  const payment = useSalePaymentFields(suggestedAmount);
  const { methodId, method, amount, cashSessionId, tenderedAmount } = payment;

  const [formError, setFormError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Sale | null>(null);

  function resetAll() {
    setLines([]);
    payment.reset();
  }

  const checkout = useMutation({
    mutationFn: async () => {
      const sale = await salesApi.create({
        customerId: null,
        documentDate: today(),
        items: lineItems(lines),
      });
      try {
        await salesApi.post(sale.id);
      } catch (error) {
        void error;
        throw new PartialCheckoutError(sale.id, "post");
      }
      try {
        await salesFinanceApi.createPayment(sale.id, {
          paymentMethodId: methodId,
          amount,
          cashSessionId: method?.kind === "CASH" ? cashSessionId : undefined,
          tenderedAmount:
            method?.kind === "CASH" && tenderedAmount ? tenderedAmount : undefined,
        });
      } catch (error) {
        void error;
        throw new PartialCheckoutError(sale.id, "payment");
      }
      return sale;
    },
    onSuccess: async (sale) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.salesRoot }),
        invalidateInventoryIntegration(client),
        invalidateCashIntegration(client),
      ]);
      resetAll();
      setFormError(null);
      setConfirmed(sale);
    },
  });

  const draftSave = useMutation({
    mutationFn: () =>
      salesApi.create({
        customerId: null,
        documentDate: today(),
        items: lineItems(lines),
      }),
    onSuccess: async (sale) => {
      await client.invalidateQueries({ queryKey: queryKeys.salesRoot });
      resetAll();
      setConfirmed(sale);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setConfirmed(null);
    const lineError = validateLines(lines);
    if (lineError) {
      setFormError(lineError);
      return;
    }
    if (duplicate) {
      setFormError("Un producto no puede repetirse en la misma ubicación.");
      return;
    }
    if (!canCheckoutInOneStep) {
      setFormError(null);
      draftSave.mutate();
      return;
    }
    if (!methodId) {
      setFormError("Elegí el método de pago.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setFormError("Ingresá el monto a cobrar.");
      return;
    }
    if (method?.kind === "CASH" && !cashSessionId) {
      setFormError("Elegí la sesión de caja abierta.");
      return;
    }
    if (
      method?.kind === "CASH" &&
      tenderedAmount &&
      !isMoneyAtLeast(tenderedAmount, amount)
    ) {
      setFormError("El monto recibido no puede ser menor que el cobro.");
      return;
    }
    setFormError(null);
    checkout.mutate();
  }

  const pending = checkout.isPending || draftSave.isPending;
  const mutationError = checkout.error ?? draftSave.error;
  const partial =
    mutationError instanceof PartialCheckoutError ? mutationError : null;

  return (
    <form className="panel erp-form sales-panel" onSubmit={submit}>
      <h2>Venta rápida (mostrador)</h2>
      <p className="sales-panel__hint">
        Cargá todos los productos del cliente y cobrá una sola vez al final
        con «Cobrar y confirmar».
      </p>
      {confirmed ? (
        <FormFeedback
          success={`Venta #${confirmed.number} lista${
            canCheckoutInOneStep ? ` — cobrada ${formatMoney(confirmed.total)}.` : "."
          } Podés seguir con el próximo cliente.`}
        />
      ) : null}
      {partial ? (
        <FormFeedback
          error={
            partial.stage === "post"
              ? `La venta #${partial.saleId} se creó pero no se pudo confirmar. Completala desde Ventas.`
              : `La venta se confirmó pero el cobro falló. Registralo desde el detalle de la venta.`
          }
        />
      ) : (
        <FormFeedback
          error={
            formError ??
            (mutationError && !(mutationError instanceof PartialCheckoutError)
              ? apiErrorMessage(mutationError)
              : null)
          }
        />
      )}
      <ProductLinesEditor
        idPrefix="mostrador"
        lines={lines}
        updateLine={updateLine}
        onRemove={removeLine}
        onAddProduct={addScannedProduct}
        handleScan={handleScan}
        scanFeedback={scanFeedback}
        scanTitle="Escanear producto para la venta"
      />
      <div className="sale-totals-bar">
        <div className="sale-totals-bar__total">
          <span className="sale-totals-bar__label">Total</span>
          <span className="sale-totals-bar__amount">
            {formatMoney(total.toFixed(2))}
          </span>
        </div>
        {canCheckoutInOneStep ? (
          <div className="form-grid quick-sale-payment">
            <SalePaymentFieldset idPrefix="mostrador" fields={payment} />
          </div>
        ) : null}
        <div className="form-actions">
          <Button type="submit" loading={pending} className="button--large">
            {canCheckoutInOneStep ? "Cobrar y confirmar" : "Guardar venta"}
          </Button>
        </div>
      </div>
    </form>
  );
}

/**
 * Center column: a sale for someone in the customer directory — can be
 * settled now or left to credit, so it keeps the draft → confirm → collect
 * flow instead of collapsing to one step.
 */
function CustomerSalePanel({
  resumeId,
  presetCustomerId,
  active,
}: {
  resumeId?: string;
  presetCustomerId?: string;
  active: boolean;
}) {
  const detail = useQuery({
    queryKey: queryKeys.sale(resumeId ?? ""),
    queryFn: () => salesApi.detail(resumeId!),
    enabled: Boolean(resumeId),
  });
  if (resumeId && detail.isLoading)
    return (
      <div className="panel">
        <h2>Cliente registrado</h2>
        <p className="muted">Cargando venta…</p>
      </div>
    );
  if (resumeId && (detail.error || !detail.data))
    return (
      <div className="panel">
        <h2>Cliente registrado</h2>
        <FormFeedback error={apiErrorMessage(detail.error)} />
      </div>
    );
  if (resumeId && detail.data && detail.data.status !== "DRAFT")
    return (
      <div className="panel">
        <h2>Cliente registrado</h2>
        <FormFeedback error="Esa venta ya no está en borrador — revisala desde Ventas." />
      </div>
    );
  return (
    <CustomerSaleForm
      id={resumeId}
      initial={detail.data}
      presetCustomerId={presetCustomerId}
      active={active}
    />
  );
}

interface SecondaryDraft {
  customerId: string;
  paymentDueDate: string;
  notes: string;
  lines: Line[];
}

function CustomerSaleForm({
  id,
  initial,
  presetCustomerId,
  active,
}: {
  id?: string;
  initial?: Sale;
  presetCustomerId?: string;
  active: boolean;
}) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [customerId, setCustomerId] = useState(
    initial?.customerId ?? presetCustomerId ?? "",
  );
  const [paymentDueDate, setPaymentDueDate] = useState(
    initial?.paymentDueDate?.slice(0, 10) ?? "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const documentDate = initial?.documentDate.slice(0, 10) ?? today();
  const { lines, updateLine, removeLine, addScannedProduct, handleScan, scanFeedback, duplicate, setLines } =
    useSaleLineItems("cliente", initial, active);
  const total = linesTotal(lines);
  const [formError, setFormError] = useState<string | null>(null);

  const draftKey = `sale-draft:cliente:${id ?? "new"}`;
  const [restorableDraft] = useState(() => readDraft<SecondaryDraft>(draftKey));
  const [draftResolved, setDraftResolved] = useState(!restorableDraft);
  function restoreDraft() {
    if (!restorableDraft) return;
    const d = restorableDraft.data;
    setCustomerId(d.customerId);
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
    { customerId, paymentDueDate, notes, lines },
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
      void navigate(`/app/sales/${sale.id}`);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const lineError = validateLines(lines);
    if (lineError) {
      setFormError(lineError);
      return;
    }
    if (duplicate) {
      setFormError("Una combinación de producto y ubicación solo puede aparecer una vez.");
      return;
    }
    setFormError(null);
    mutation.mutate({
      customerId: customerId || null,
      documentDate,
      paymentDueDate: paymentDueDate || undefined,
      notes: notes || undefined,
      items: lineItems(lines),
    });
  }

  return (
    <form className="panel erp-form sales-panel" onSubmit={submit}>
      <h2>Cliente registrado</h2>
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
      <FormFeedback
        error={formError ?? (mutation.error ? apiErrorMessage(mutation.error) : null)}
      />
      <CustomerSelector
        id="cliente-customer"
        label="Cliente"
        required
        value={customerId}
        emptyLabel="Elegí un cliente"
        onChange={setCustomerId}
      />
      <ProductLinesEditor
        idPrefix="cliente"
        lines={lines}
        updateLine={updateLine}
        onRemove={removeLine}
        onAddProduct={addScannedProduct}
        handleScan={handleScan}
        scanFeedback={scanFeedback}
        scanTitle="Escanear producto para la venta"
      />
      <details className="filter-details">
        <summary>A crédito / notas (opcional)</summary>
        <div className="form-grid">
          <Field
            label="Fecha de vencimiento"
            htmlFor="cliente-due"
            hint="Si la venta queda a crédito, marca cuándo vence en Cuentas por cobrar."
          >
            <input
              id="cliente-due"
              type="date"
              value={paymentDueDate}
              onChange={(e) => setPaymentDueDate(e.target.value)}
            />
          </Field>
          <Field label="Notas" htmlFor="cliente-notes">
            <textarea
              id="cliente-notes"
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
      </details>
      <div className="sale-totals-bar">
        <div className="sale-totals-bar__total">
          <span className="sale-totals-bar__label">Total</span>
          <span className="sale-totals-bar__amount">
            {formatMoney(total.toFixed(2))}
          </span>
        </div>
        <div className="form-actions">
          <Button type="submit" loading={mutation.isPending} className="button--large">
            Guardar venta
          </Button>
        </div>
      </div>
    </form>
  );
}

/**
 * Right column: several vehicles/customers can be worked on at once, each as
 * its own open account — tabs switch which one is focused without leaving
 * the workspace or losing the other two columns' state.
 */
function OpenAccountColumn({
  focusedId,
  onFocusedIdChange,
  active,
}: {
  focusedId?: string;
  onFocusedIdChange: (id?: string) => void;
  active: boolean;
}) {
  const detail = useQuery({
    queryKey: queryKeys.sale(focusedId ?? ""),
    queryFn: () => salesApi.detail(focusedId!),
    enabled: Boolean(focusedId),
  });
  return (
    <div className="panel sales-panel">
      <h2>Cuentas abiertas</h2>
      <OpenAccountsBar
        activeSaleId={focusedId}
        onSelect={onFocusedIdChange}
        onNew={() => onFocusedIdChange(undefined)}
      />
      {focusedId && detail.isLoading ? (
        <p className="muted">Cargando cuenta…</p>
      ) : focusedId && (detail.error || !detail.data) ? (
        <FormFeedback error={apiErrorMessage(detail.error)} />
      ) : focusedId && detail.data && detail.data.status !== "DRAFT" ? (
        <FormFeedback error="Esa cuenta ya se cerró — revisala desde Ventas." />
      ) : (
        <OpenAccountForm
          key={focusedId ?? "new"}
          id={focusedId}
          initial={detail.data}
          active={active}
          onSaved={onFocusedIdChange}
        />
      )}
    </div>
  );
}

interface AccountDraft {
  accountLabel: string;
  customerId: string;
  paymentDueDate: string;
  notes: string;
  lines: Line[];
}

function OpenAccountForm({
  id,
  initial,
  active,
  onSaved,
}: {
  id?: string;
  initial?: Sale;
  active: boolean;
  onSaved: (saleId: string) => void;
}) {
  const client = useQueryClient();
  const [accountLabel, setAccountLabel] = useState(initial?.accountLabel ?? "");
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [paymentDueDate, setPaymentDueDate] = useState(
    initial?.paymentDueDate?.slice(0, 10) ?? "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const documentDate = initial?.documentDate.slice(0, 10) ?? today();
  const { lines, updateLine, removeLine, addScannedProduct, handleScan, scanFeedback, duplicate, setLines } =
    useSaleLineItems("cuenta", initial, active);
  const total = linesTotal(lines);
  const [formError, setFormError] = useState<string | null>(null);

  const draftKey = `sale-draft:cuenta:${id ?? "new"}`;
  const [restorableDraft] = useState(() => readDraft<AccountDraft>(draftKey));
  const [draftResolved, setDraftResolved] = useState(!restorableDraft);
  function restoreDraft() {
    if (!restorableDraft) return;
    const d = restorableDraft.data;
    setAccountLabel(d.accountLabel);
    setCustomerId(d.customerId);
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
    { accountLabel, customerId, paymentDueDate, notes, lines },
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
      // A brand-new account switches the tab bar to focus it; an existing
      // one just stays put (it's already the focused id).
      onSaved(sale.id);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!accountLabel.trim()) {
      setFormError(
        "Ponle una etiqueta a la cuenta para poder distinguirla (por ejemplo «Corolla azul – Juan»).",
      );
      return;
    }
    const lineError = validateLines(lines);
    if (lineError) {
      setFormError(lineError);
      return;
    }
    if (duplicate) {
      setFormError("Una combinación de producto y ubicación solo puede aparecer una vez.");
      return;
    }
    setFormError(null);
    mutation.mutate({
      customerId: customerId || null,
      accountLabel: accountLabel.trim(),
      documentDate,
      paymentDueDate: paymentDueDate || undefined,
      notes: notes || undefined,
      items: lineItems(lines),
    });
  }

  return (
    <form className="erp-form" onSubmit={submit}>
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
      <FormFeedback
        error={formError ?? (mutation.error ? apiErrorMessage(mutation.error) : null)}
      />
      <Field
        label="Etiqueta de la cuenta"
        htmlFor="cuenta-label"
        required
        hint="Cómo la reconoces en el mostrador: vehículo, apodo, color… Ej. «Corolla azul – Juan»."
      >
        <input
          id="cuenta-label"
          required
          maxLength={120}
          placeholder="Corolla azul – Juan"
          value={accountLabel}
          onChange={(e) => setAccountLabel(e.target.value)}
        />
      </Field>
      <ProductLinesEditor
        idPrefix="cuenta"
        lines={lines}
        updateLine={updateLine}
        onRemove={removeLine}
        onAddProduct={addScannedProduct}
        handleScan={handleScan}
        scanFeedback={scanFeedback}
        scanTitle="Escanear producto para la cuenta"
      />
      <details className="filter-details">
        <summary>Cliente / vencimiento / notas (opcional)</summary>
        <div className="form-grid">
          <CustomerSelector
            id="cuenta-customer"
            label="Cliente registrado"
            value={customerId}
            onChange={setCustomerId}
          />
          <Field label="Fecha de vencimiento" htmlFor="cuenta-due">
            <input
              id="cuenta-due"
              type="date"
              value={paymentDueDate}
              onChange={(e) => setPaymentDueDate(e.target.value)}
            />
          </Field>
          <Field label="Notas" htmlFor="cuenta-notes">
            <textarea
              id="cuenta-notes"
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
      </details>
      <div className="sale-totals-bar">
        <div className="sale-totals-bar__total">
          <span className="sale-totals-bar__label">Total</span>
          <span className="sale-totals-bar__amount">
            {formatMoney(total.toFixed(2))}
          </span>
        </div>
        <div className="form-actions">
          <Button type="submit" loading={mutation.isPending} className="button--large">
            Guardar cuenta
          </Button>
        </div>
      </div>
    </form>
  );
}

