import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { salesFinanceApi, type SaleFinancialOperationInput } from "../api/sales-finance-api";
import { salesApi } from "../api/sales-api";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { CommercialStatusBadge } from "../components/CommercialStatusBadge";
import { ErpTable, type ErpColumn } from "../components/ErpTable";
import { Field } from "../components/Field";
import { FormFeedback } from "../components/FormFeedback";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { OpenCashSessionSelector, PaymentMethodSelector } from "../components/PurchasingSelectors";
import { queryKeys } from "../query/query-keys";
import { invalidateCashIntegration } from "../query/invalidation";
import type { PaymentMethod } from "../types/purchasing";
import type { SalePayment } from "../types/sales";
import { apiErrorMessage } from "../utils/api-error";
import { formatDateTime, formatMoney, formatPaymentType, isMoneyAtLeast, isPositiveMoneyAtMost } from "../utils/formatters";

type OperationKind = "payment" | "refund";

export function SalePaymentsPage() {
  const { id = "" } = useParams();
  const sale = useQuery({ queryKey: queryKeys.sale(id), queryFn: () => salesApi.detail(id) });
  if (sale.isLoading) return <div className="panel">Cargando venta…</div>;
  if (!sale.data || sale.error) return <FormFeedback error={apiErrorMessage(sale.error)} />;
  return <FinancialOperations kind="payment" ownerId={id} saleId={id} ownerNumber={sale.data.number} status={sale.data.status} maximum={sale.data.paymentSummary?.outstandingAmount ?? "0.00"} backPath={`/app/sales/${id}`} />;
}

export function SaleRefundsPage() {
  const { id = "" } = useParams();
  const detail = useQuery({ queryKey: queryKeys.saleReturn(id), queryFn: () => salesApi.returnDetail(id) });
  if (detail.isLoading) return <div className="panel">Cargando devolución…</div>;
  if (!detail.data || detail.error) return <FormFeedback error={apiErrorMessage(detail.error)} />;
  return <FinancialOperations kind="refund" ownerId={id} saleId={detail.data.saleId} ownerNumber={detail.data.number} status={detail.data.status} maximum={detail.data.refundSummary?.refundableAmount ?? "0.00"} backPath={`/app/sales/returns/${id}`} />;
}

function FinancialOperations({ kind, ownerId, saleId, ownerNumber, status, maximum, backPath }: { kind: OperationKind; ownerId: string; saleId: string; ownerNumber: number; status: string; maximum: string; backPath: string }) {
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const params = { page, limit: 20 };
  const history = useQuery({ queryKey: kind === "payment" ? queryKeys.salePayments(ownerId, params) : queryKeys.saleRefunds(ownerId, params), queryFn: () => kind === "payment" ? salesFinanceApi.payments(ownerId, params) : salesFinanceApi.refunds(ownerId, params), enabled: hasPermission("payments.read") });
  const [methodId, setMethodId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>();
  const [amount, setAmount] = useState("");
  const [tenderedAmount, setTenderedAmount] = useState("");
  const [cashSessionId, setCashSessionId] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reversing, setReversing] = useState<SalePayment>();
  const [reason, setReason] = useState("");
  const [reversalCashSessionId, setReversalCashSessionId] = useState("");
  const invalidate = async () => Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.salePaymentsRoot }),
    client.invalidateQueries({ queryKey: queryKeys.saleRefundsRoot }),
    client.invalidateQueries({ queryKey: queryKeys.salesRoot }),
    client.invalidateQueries({ queryKey: queryKeys.saleReturnsRoot }),
    client.invalidateQueries({ queryKey: queryKeys.receivablesRoot }),
    client.invalidateQueries({ queryKey: queryKeys.customerAccountsRoot }),
    client.invalidateQueries({ queryKey: queryKeys.sale(saleId) }),
    invalidateCashIntegration(client),
    ...(kind === "refund" ? [client.invalidateQueries({ queryKey: queryKeys.saleReturn(ownerId) })] : []),
  ]);
  const create = useMutation({ mutationFn: (body: SaleFinancialOperationInput) => kind === "payment" ? salesFinanceApi.createPayment(ownerId, body) : salesFinanceApi.createRefund(ownerId, body), onSuccess: async (row) => { await invalidate(); setAmount(""); setTenderedAmount(""); setExternalReference(""); setNotes(""); setSuccess(row.changeAmount ? `Operación registrada. Cambio confirmado por el servidor: ${formatMoney(row.changeAmount)}.` : "Operación registrada correctamente."); } });
  const reverse = useMutation({ mutationFn: () => salesFinanceApi.reverse(reversing!.id, { reason, cashSessionId: reversing?.cashSessionId ? reversalCashSessionId : undefined }), onSuccess: async () => { await invalidate(); setReversing(undefined); setReason(""); setReversalCashSessionId(""); } });
  function submit(event: FormEvent) {
    event.preventDefault();
    setSuccess(null);
    if (!isPositiveMoneyAtMost(amount, maximum)) { setFormError(`El monto debe ser positivo y no mayor a ${formatMoney(maximum)}.`); return; }
    if (kind === "payment" && method?.kind === "CASH" && tenderedAmount && !isMoneyAtLeast(tenderedAmount, amount)) { setFormError("El monto recibido no puede ser menor que el pago."); return; }
    setFormError(null);
    create.mutate({ paymentMethodId: methodId, amount, cashSessionId: method?.kind === "CASH" ? cashSessionId : undefined, tenderedAmount: kind === "payment" && method?.kind === "CASH" && tenderedAmount ? tenderedAmount : undefined, externalReference: externalReference || undefined, notes: notes || undefined });
  }
  const canSelectMethod = hasPermission("payment-methods.read");
  const cashReady = method?.kind !== "CASH" || hasPermission("cash-sessions.read");
  const canCreate = hasPermission("payments.create") && canSelectMethod && cashReady && status === "POSTED" && maximum !== "0.00";
  const columns: ErpColumn<SalePayment>[] = [
    { key: "number", header: "Operación", cell: (row) => <><strong>#{row.number}</strong><small>{formatPaymentType(row.type)}</small></> },
    { key: "date", header: "Fecha", cell: (row) => formatDateTime(row.createdAt) },
    { key: "method", header: "Método", cell: (row) => <><span>{row.paymentMethod.name}</span><small>{row.externalReference || "Sin referencia"}</small></> },
    { key: "amount", header: "Monto", cell: (row) => <><strong>{formatMoney(row.amount)}</strong>{row.tenderedAmount && <small>Recibido {formatMoney(row.tenderedAmount)} · cambio {formatMoney(row.changeAmount ?? "0")}</small>}</> },
    { key: "status", header: "Estado", cell: (row) => <CommercialStatusBadge status={row.status} /> },
    { key: "action", header: "Acción", cell: (row) => row.status === "POSTED" && hasPermission("payments.reverse") ? <Button variant="danger" onClick={() => setReversing(row)}>Revertir</Button> : "—" },
  ];
  return <div className="page-stack"><PageHeader eyebrow={kind === "payment" ? "Pagos de venta" : "Reembolsos al cliente"} title={`${kind === "payment" ? "Venta" : "Devolución"} #${ownerNumber}`} description={`Máximo actualmente autorizado por el servidor: ${formatMoney(maximum)}`} actions={<Link className="button button--secondary" to={backPath}>Volver al documento</Link>} />
    {!hasPermission("payments.read") ? <section className="panel"><p>No tiene permiso para consultar el historial financiero.</p></section> : <section className="panel"><h2>Historial</h2><ErpTable columns={columns} rows={history.data?.data} rowKey={(row) => row.id} loading={history.isLoading} error={history.error ? apiErrorMessage(history.error) : undefined} onRetry={() => void history.refetch()} emptyTitle="Sin operaciones" /><Pagination meta={history.data?.meta} onPageChange={setPage} /></section>}
    {hasPermission("payments.create") && <form className="panel erp-form" onSubmit={submit}><h2>{kind === "payment" ? "Registrar pago" : "Registrar reembolso"}</h2><FormFeedback success={success} error={!canSelectMethod ? "No tiene permiso para consultar los métodos de pago." : method?.kind === "CASH" && !hasPermission("cash-sessions.read") ? "No tiene permiso para consultar sesiones de caja para una operación en efectivo." : formError ?? (create.error ? apiErrorMessage(create.error) : null)} /><div className="form-grid"><PaymentMethodSelector id={`${kind}-method`} label="Método de pago" required value={methodId} enabled={canSelectMethod} onChange={(value, selected) => { setMethodId(value); setMethod(selected); setCashSessionId(""); setTenderedAmount(""); }} /><Field label="Monto" htmlFor={`${kind}-amount`} required hint={`No mayor a ${formatMoney(maximum)}`}><input id={`${kind}-amount`} required inputMode="decimal" pattern="\d+(\.\d{1,2})?" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>{method?.kind === "CASH" && <OpenCashSessionSelector id={`${kind}-session`} label="Sesión de caja ABIERTA" required value={cashSessionId} enabled={hasPermission("cash-sessions.read")} onChange={setCashSessionId} />}{kind === "payment" && method?.kind === "CASH" && <Field label="Monto recibido" htmlFor="payment-tendered" hint="El sistema calcula y devuelve el cambio."><input id="payment-tendered" inputMode="decimal" pattern="\d+(\.\d{1,2})?" value={tenderedAmount} onChange={(e) => setTenderedAmount(e.target.value)} /></Field>}<Field label="Referencia externa" htmlFor={`${kind}-reference`}><input id={`${kind}-reference`} maxLength={160} value={externalReference} onChange={(e) => setExternalReference(e.target.value)} /></Field><Field label="Notas" htmlFor={`${kind}-notes`}><textarea id={`${kind}-notes`} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div><div className="form-actions"><Button type="submit" loading={create.isPending} disabled={!canCreate}>Registrar {kind === "payment" ? "pago" : "reembolso"}</Button></div></form>}
    {reversing && <form className="panel erp-form" onSubmit={(event) => { event.preventDefault(); reverse.mutate(); }}><h2>Revertir operación #{reversing.number}</h2><FormFeedback error={reverse.error ? apiErrorMessage(reverse.error) : null} /><Field label="Motivo" htmlFor="reversal-reason" required><textarea id="reversal-reason" required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>{reversing.cashSessionId && <OpenCashSessionSelector id="reversal-session" label="Sesión ABIERTA para reversión" required value={reversalCashSessionId} enabled={hasPermission("cash-sessions.read")} onChange={setReversalCashSessionId} />}<div className="form-actions"><Button type="button" variant="secondary" onClick={() => setReversing(undefined)}>Cerrar</Button><Button type="submit" variant="danger" loading={reverse.isPending} disabled={Boolean(reversing.cashSessionId) && !hasPermission("cash-sessions.read")}>Confirmar reversión</Button></div></form>}
  </div>;
}
