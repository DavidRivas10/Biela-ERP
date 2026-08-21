import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  purchasingFinanceApi,
  type FinancialOperationInput,
} from "../api/purchasing-finance-api";
import { purchasingApi } from "../api/purchasing-api";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { CommercialStatusBadge } from "../components/CommercialStatusBadge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ErpTable, type ErpColumn } from "../components/ErpTable";
import { Field } from "../components/Field";
import { FormFeedback } from "../components/FormFeedback";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import {
  OpenCashSessionSelector,
  PaymentMethodSelector,
} from "../components/PurchasingSelectors";
import { queryKeys } from "../query/query-keys";
import type {
  Payment,
  PaymentMethod,
  PurchaseReturnItem,
} from "../types/purchasing";
import { apiErrorMessage } from "../utils/api-error";
import {
  formatDateTime,
  formatMoney,
  isPositiveMoneyAtMost,
} from "../utils/formatters";
import { invalidateInventory } from "./ReceiptReturnPages";

const emptyOperation: FinancialOperationInput = {
  paymentMethodId: "",
  amount: "",
  cashSessionId: "",
  externalReference: "",
  notes: "",
};

async function invalidateSettlement(
  client: ReturnType<typeof useQueryClient>,
  purchaseId: string,
) {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.purchase(purchaseId) }),
    client.invalidateQueries({ queryKey: queryKeys.purchasesRoot }),
    client.invalidateQueries({ queryKey: queryKeys.purchasePaymentsRoot }),
    client.invalidateQueries({ queryKey: queryKeys.supplierRefundsRoot }),
    client.invalidateQueries({
      queryKey: queryKeys.purchaseReturnDetailsRoot,
    }),
    client.invalidateQueries({ queryKey: queryKeys.payablesRoot }),
    client.invalidateQueries({ queryKey: queryKeys.supplierAccountsRoot }),
    client.invalidateQueries({ queryKey: ["commercial", "summary"] }),
  ]);
}

export function PurchasePaymentsPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<FinancialOperationInput>(emptyOperation);
  const [method, setMethod] = useState<PaymentMethod>();
  const [confirmCreate, setConfirmCreate] = useState(false);
  const purchase = useQuery({
    queryKey: queryKeys.purchase(id),
    queryFn: () => purchasingApi.purchase(id),
  });
  const paymentParams = { page, limit: 20 };
  const payments = useQuery({
    queryKey: queryKeys.purchasePayments(id, paymentParams),
    queryFn: () => purchasingFinanceApi.purchasePayments(id, paymentParams),
    enabled: hasPermission("payments.read"),
  });
  const create = useMutation({
    mutationFn: () =>
      purchasingFinanceApi.createPurchasePayment(id, cleanOperation(form)),
    onSuccess: async () => {
      await invalidateSettlement(client, id);
      setForm(emptyOperation);
      setMethod(undefined);
      setConfirmCreate(false);
    },
  });
  const summary = purchase.data?.paymentSummary;
  const paymentAmountAllowed = isPositiveMoneyAtMost(
    form.amount,
    summary?.outstandingAmount,
  );
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Liquidación"
        title={`Pagos de compra #${purchase.data?.number ?? "…"}`}
        description="Cada registro permite pagos parciales; varios registros permiten dividir métodos."
      />
      {summary ? (
        <section className="panel">
          <div className="section-heading">
            <h2>Saldo del servidor</h2>
            <CommercialStatusBadge status={summary.settlementStatus} />
          </div>
          <div className="commercial-summary-grid">
            <span>
              Obligación neta{" "}
              <strong>{formatMoney(summary.netPurchaseObligation)}</strong>
            </span>
            <span>
              Pagado activo{" "}
              <strong>{formatMoney(summary.netPaidAmount)}</strong>
            </span>
            <span>
              Pendiente{" "}
              <strong>{formatMoney(summary.outstandingAmount)}</strong>
            </span>
            <span>
              Crédito proveedor{" "}
              <strong>{formatMoney(summary.supplierCreditAmount)}</strong>
            </span>
          </div>
        </section>
      ) : null}
      {hasPermission("purchases.pay") ? (
        <form
          className="panel erp-form"
          onSubmit={(event) => {
            event.preventDefault();
            setConfirmCreate(true);
          }}
        >
          <h2>Registrar pago</h2>
          <FormFeedback
            error={create.error ? apiErrorMessage(create.error) : null}
          />
          <div className="form-grid">
            <PaymentMethodSelector
              id="purchase-payment-method"
              label="Método de pago"
              required
              enabled={hasPermission("payment-methods.read")}
              value={form.paymentMethodId}
              onChange={(paymentMethodId, selected) => {
                setMethod(selected);
                setForm({ ...form, paymentMethodId, cashSessionId: "" });
              }}
            />
            <Field
              label="Monto"
              htmlFor="purchase-payment-amount"
              required
              hint={
                summary
                  ? `Máximo actual: ${formatMoney(summary.outstandingAmount)}`
                  : undefined
              }
            >
              <input
                id="purchase-payment-amount"
                required
                inputMode="decimal"
                pattern="(?=.*[1-9])\d+(\.\d{1,2})?"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            {method?.kind === "CASH" ? (
              <OpenCashSessionSelector
                id="purchase-payment-session"
                label="Sesión de caja OPEN"
                required
                enabled={hasPermission("cash-sessions.read")}
                value={form.cashSessionId ?? ""}
                onChange={(cashSessionId) =>
                  setForm({ ...form, cashSessionId })
                }
              />
            ) : null}
            <Field
              label="Referencia externa"
              htmlFor="purchase-payment-reference"
            >
              <input
                id="purchase-payment-reference"
                maxLength={160}
                value={form.externalReference}
                onChange={(e) =>
                  setForm({ ...form, externalReference: e.target.value })
                }
              />
            </Field>
            <Field label="Notas" htmlFor="purchase-payment-notes">
              <textarea
                id="purchase-payment-notes"
                maxLength={500}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          {method?.kind === "CASH" ? (
            <p className="transaction-warning">
              Este pago reduce el efectivo esperado de la sesión de caja.
            </p>
          ) : (
            <p>
              Los métodos no monetarios liquidan la compra sin movimiento físico
              de caja.
            </p>
          )}
          <div className="form-actions">
            <Button
              type="submit"
              disabled={
                !form.paymentMethodId ||
                !paymentAmountAllowed ||
                (method?.kind === "CASH" && !form.cashSessionId)
              }
            >
              Revisar pago
            </Button>
          </div>
        </form>
      ) : null}
      {hasPermission("payments.read") ? (
        <PaymentHistory
          title="Historial de pagos"
          rows={payments.data?.data}
          loading={payments.isLoading}
          error={payments.error ? apiErrorMessage(payments.error) : undefined}
          meta={payments.data?.meta}
          onPageChange={setPage}
          purchaseId={id}
        />
      ) : null}
      <ConfirmDialog
        open={confirmCreate}
        title="Registrar pago de compra"
        description={`${formatMoney(form.amount || "0")} mediante ${method?.name ?? "el método seleccionado"}.${method?.kind === "CASH" ? " Reducirá el efectivo esperado." : " No afectará efectivo físico."}`}
        loading={create.isPending}
        onCancel={() => setConfirmCreate(false)}
        onConfirm={() => create.mutate()}
      />
    </div>
  );
}

export function PurchaseReturnDetailPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const [refundPage, setRefundPage] = useState(1);
  const [confirmPost, setConfirmPost] = useState(false);
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [form, setForm] = useState<FinancialOperationInput>(emptyOperation);
  const [method, setMethod] = useState<PaymentMethod>();
  const detail = useQuery({
    queryKey: queryKeys.purchaseReturn(id),
    queryFn: () => purchasingApi.purchaseReturn(id),
  });
  const refundParams = { page: refundPage, limit: 20 };
  const refunds = useQuery({
    queryKey: queryKeys.supplierRefunds(id, refundParams),
    queryFn: () => purchasingFinanceApi.supplierRefunds(id, refundParams),
    enabled: hasPermission("payments.read"),
  });
  const post = useMutation({
    mutationFn: () => purchasingApi.postReturn(id),
    onSuccess: async (row) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.purchaseReturn(id) }),
        client.invalidateQueries({ queryKey: queryKeys.returnsRoot }),
        invalidateInventory(client),
        invalidateSettlement(client, row.purchaseId),
      ]);
      setConfirmPost(false);
    },
  });
  const refund = useMutation({
    mutationFn: () =>
      purchasingFinanceApi.createSupplierRefund(id, cleanOperation(form)),
    onSuccess: async () => {
      if (detail.data)
        await invalidateSettlement(client, detail.data.purchaseId);
      await client.invalidateQueries({
        queryKey: queryKeys.purchaseReturn(id),
      });
      setForm(emptyOperation);
      setMethod(undefined);
      setConfirmRefund(false);
    },
  });
  if (detail.isLoading)
    return <div className="panel">Cargando devolución…</div>;
  if (!detail.data || detail.error)
    return (
      <FormFeedback
        error={
          detail.error
            ? apiErrorMessage(detail.error)
            : "Devolución no encontrada."
        }
      />
    );
  const row = detail.data;
  const refundAmountAllowed = isPositiveMoneyAtMost(
    form.amount,
    row.refundSummary?.refundableAmount,
  );
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Devolución a proveedor"
        title={`Devolución #${row.number}`}
        description={`Compra #${row.purchase.number} · ${row.reason}`}
        actions={
          row.status === "DRAFT" && hasPermission("purchases.return") ? (
            <Button onClick={() => setConfirmPost(true)}>
              Publicar devolución
            </Button>
          ) : undefined
        }
      />
      <FormFeedback
        success={post.isSuccess ? "Devolución registrada correctamente." : null}
        error={post.error ? apiErrorMessage(post.error) : null}
      />
      <section className="panel detail-card">
        <dl>
          <div>
            <dt>Estado</dt>
            <dd>
              <CommercialStatusBadge status={row.status} />
            </dd>
          </div>
          <div>
            <dt>Motivo</dt>
            <dd>{row.reason}</dd>
          </div>
          <div>
            <dt>Creada</dt>
            <dd>{formatDateTime(row.createdAt)}</dd>
          </div>
          <div>
            <dt>Publicada</dt>
            <dd>{row.postedAt ? formatDateTime(row.postedAt) : "—"}</dd>
          </div>
        </dl>
      </section>
      <ReturnItems rows={row.items} />
      {row.refundSummary ? (
        <section className="panel">
          <h2>Crédito y reembolso</h2>
          <div className="commercial-summary-grid">
            <span>
              Valor de devolución{" "}
              <strong>{formatMoney(row.refundSummary.returnValue)}</strong>
            </span>
            <span>
              Ya reembolsado{" "}
              <strong>{formatMoney(row.refundSummary.refundedAmount)}</strong>
            </span>
            <span>
              Reembolsable actual{" "}
              <strong>{formatMoney(row.refundSummary.refundableAmount)}</strong>
            </span>
          </div>
        </section>
      ) : null}
      {row.status === "POSTED" && hasPermission("purchases.pay") ? (
        <form
          className="panel erp-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setConfirmRefund(true);
          }}
        >
          <h2>Registrar dinero recibido del proveedor</h2>
          <p>
            Este registro financiero es independiente del Inventory OUT ya
            publicado.
          </p>
          <FormFeedback
            error={refund.error ? apiErrorMessage(refund.error) : null}
          />
          <div className="form-grid">
            <PaymentMethodSelector
              id="supplier-refund-method"
              label="Método"
              required
              enabled={hasPermission("payment-methods.read")}
              value={form.paymentMethodId}
              onChange={(paymentMethodId, selected) => {
                setMethod(selected);
                setForm({ ...form, paymentMethodId, cashSessionId: "" });
              }}
            />
            <Field
              label="Monto"
              htmlFor="supplier-refund-amount"
              required
              hint={
                row.refundSummary
                  ? `Máximo actual: ${formatMoney(row.refundSummary.refundableAmount)}`
                  : undefined
              }
            >
              <input
                id="supplier-refund-amount"
                required
                inputMode="decimal"
                pattern="(?=.*[1-9])\d+(\.\d{1,2})?"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            {method?.kind === "CASH" ? (
              <OpenCashSessionSelector
                id="supplier-refund-session"
                label="Sesión de caja OPEN"
                required
                enabled={hasPermission("cash-sessions.read")}
                value={form.cashSessionId ?? ""}
                onChange={(cashSessionId) =>
                  setForm({ ...form, cashSessionId })
                }
              />
            ) : null}
            <Field
              label="Referencia externa"
              htmlFor="supplier-refund-reference"
            >
              <input
                id="supplier-refund-reference"
                maxLength={160}
                value={form.externalReference}
                onChange={(e) =>
                  setForm({ ...form, externalReference: e.target.value })
                }
              />
            </Field>
            <Field label="Notas" htmlFor="supplier-refund-notes">
              <textarea
                id="supplier-refund-notes"
                maxLength={500}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          {method?.kind === "CASH" ? (
            <p className="transaction-warning">
              Este reembolso aumenta el efectivo esperado de la sesión de caja.
            </p>
          ) : (
            <p>El método no monetario no modifica el efectivo físico.</p>
          )}
          <div className="form-actions">
            <Button
              type="submit"
              disabled={
                !form.paymentMethodId ||
                !refundAmountAllowed ||
                (method?.kind === "CASH" && !form.cashSessionId)
              }
            >
              Revisar reembolso
            </Button>
          </div>
        </form>
      ) : null}
      {hasPermission("payments.read") ? (
        <PaymentHistory
          title="Reembolsos del proveedor"
          rows={refunds.data?.data}
          loading={refunds.isLoading}
          error={refunds.error ? apiErrorMessage(refunds.error) : undefined}
          meta={refunds.data?.meta}
          onPageChange={setRefundPage}
          purchaseId={row.purchaseId}
        />
      ) : null}
      <Link
        className="button button--ghost"
        to={`/app/purchasing/purchases/${row.purchaseId}`}
      >
        Volver a la compra
      </Link>
      <ConfirmDialog
        open={confirmPost}
        title="Publicar devolución"
        description="El backend registrará Inventory OUT y el documento quedará inmutable. Esto no registra automáticamente dinero recibido."
        dangerous
        loading={post.isPending}
        onCancel={() => setConfirmPost(false)}
        onConfirm={() => post.mutate()}
      />
      <ConfirmDialog
        open={confirmRefund}
        title="Registrar reembolso del proveedor"
        description={`${formatMoney(form.amount || "0")} mediante ${method?.name ?? "el método seleccionado"}.${method?.kind === "CASH" ? " Aumentará el efectivo esperado." : " No afectará efectivo físico."}`}
        loading={refund.isPending}
        onCancel={() => setConfirmRefund(false)}
        onConfirm={() => refund.mutate()}
      />
    </div>
  );
}

function PaymentHistory({
  title,
  rows,
  loading,
  error,
  meta,
  onPageChange,
  purchaseId,
}: {
  title: string;
  rows?: Payment[];
  loading: boolean;
  error?: string;
  meta?: { page: number; limit: number; total: number; pages: number };
  onPageChange: (page: number) => void;
  purchaseId: string;
}) {
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const [target, setTarget] = useState<Payment>();
  const [reason, setReason] = useState("");
  const [cashSessionId, setCashSessionId] = useState("");
  const [confirmReverse, setConfirmReverse] = useState(false);
  const reverse = useMutation({
    mutationFn: () =>
      purchasingFinanceApi.reverse(target!.id, {
        reason,
        cashSessionId:
          target?.paymentMethod.kind === "CASH" ? cashSessionId : undefined,
      }),
    onSuccess: async () => {
      await invalidateSettlement(client, purchaseId);
      setTarget(undefined);
      setReason("");
      setCashSessionId("");
      setConfirmReverse(false);
    },
  });
  const columns: ErpColumn<Payment>[] = [
    {
      key: "number",
      header: "Operación / referencia",
      cell: (row) => (
        <>
          <strong>#{row.number}</strong>
          <small>{row.externalReference || "Sin referencia"}</small>
        </>
      ),
    },
    {
      key: "method",
      header: "Método",
      cell: (row) => (
        <>
          <strong>{row.paymentMethod.name}</strong>
          <small>{row.paymentMethod.kind}</small>
        </>
      ),
    },
    { key: "amount", header: "Monto", cell: (row) => formatMoney(row.amount) },
    {
      key: "date",
      header: "Fecha",
      cell: (row) => formatDateTime(row.createdAt),
    },
    {
      key: "status",
      header: "Estado",
      cell: (row) => <CommercialStatusBadge status={row.status} />,
    },
    {
      key: "actor",
      header: "Actor",
      cell: (row) => row.createdByActorId,
    },
    ...(hasPermission("payments.reverse")
      ? [
          {
            key: "actions",
            header: "Acciones",
            cell: (row: Payment) =>
              row.status === "POSTED" ? (
                <Button variant="ghost" onClick={() => setTarget(row)}>
                  Reversar
                </Button>
              ) : null,
          },
        ]
      : []),
  ];
  return (
    <section className="panel">
      <h2>{title}</h2>
      <FormFeedback
        error={reverse.error ? apiErrorMessage(reverse.error) : null}
      />
      <ErpTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        emptyTitle="Sin operaciones financieras"
      />
      <Pagination meta={meta} onPageChange={onPageChange} />
      {target ? (
        <form
          className="form-section erp-form"
          onSubmit={(event) => {
            event.preventDefault();
            setConfirmReverse(true);
          }}
        >
          <h2>Reversar operación #{target.number}</h2>
          <Field label="Motivo" htmlFor="reversal-reason" required>
            <textarea
              id="reversal-reason"
              required
              minLength={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          {target.paymentMethod.kind === "CASH" ? (
            <OpenCashSessionSelector
              id="reversal-session"
              label="Sesión OPEN para compensación"
              required
              enabled={hasPermission("cash-sessions.read")}
              value={cashSessionId}
              onChange={setCashSessionId}
            />
          ) : null}
          <p>
            La operación original conservará su historial.{" "}
            {target.paymentMethod.kind === "CASH"
              ? "Se registrará el movimiento físico compensatorio."
              : "No habrá movimiento físico de caja."}
          </p>
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setTarget(undefined)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="danger" loading={reverse.isPending}>
              Revisar reversión
            </Button>
          </div>
        </form>
      ) : null}
      <ConfirmDialog
        open={confirmReverse}
        title={`Reversar operación #${target?.number ?? ""}`}
        description={`La operación original permanecerá en el historial y se creará la compensación correspondiente.${target?.paymentMethod.kind === "CASH" ? " La sesión OPEN seleccionada recibirá el efecto físico inverso." : " No habrá movimiento físico de caja."}`}
        confirmLabel="Confirmar reversión"
        dangerous
        loading={reverse.isPending}
        onCancel={() => setConfirmReverse(false)}
        onConfirm={() => reverse.mutate()}
      />
    </section>
  );
}

function ReturnItems({ rows }: { rows: PurchaseReturnItem[] }) {
  return (
    <section className="panel">
      <h2>Mercadería devuelta</h2>
      <div className="table-scroll" tabIndex={0}>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Ubicación origen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.purchaseItem.product.code}</strong>
                  <small>{row.purchaseItem.product.name}</small>
                </td>
                <td>{row.quantityReturned}</td>
                <td>
                  {row.sourceLocation.code} · {row.sourceLocation.name}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function cleanOperation(
  value: FinancialOperationInput,
): FinancialOperationInput {
  return {
    paymentMethodId: value.paymentMethodId,
    amount: value.amount,
    cashSessionId: value.cashSessionId || undefined,
    externalReference: value.externalReference || undefined,
    notes: value.notes || undefined,
  };
}
