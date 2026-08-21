import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { cashApi, type CashRegisterInput } from "../api/cash-api";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { CashRegisterSelector } from "../components/CashAdminSelectors";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ErpTable, type ErpColumn } from "../components/ErpTable";
import { Field } from "../components/Field";
import { FormFeedback } from "../components/FormFeedback";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { StatusBadge } from "../components/StatusBadge";
import { useUrlFilters } from "../hooks/use-url-filters";
import { queryKeys } from "../query/query-keys";
import {
  invalidateCashIntegration,
  invalidateCommercialSummary,
} from "../query/invalidation";
import type {
  CashMovement,
  CashMovementType,
  CashRegister,
  CashSession,
} from "../types/cash";
import { apiErrorMessage } from "../utils/api-error";
import { formatDateTime, formatMoney, isMoneyAtLeast, isPositiveMoneyAtMost } from "../utils/formatters";

const MOVEMENT_TYPES: CashMovementType[] = [
  "SALE_PAYMENT",
  "SALE_PAYMENT_REVERSAL",
  "SALE_REFUND",
  "SALE_REFUND_REVERSAL",
  "PURCHASE_PAYMENT",
  "PURCHASE_PAYMENT_REVERSAL",
  "SUPPLIER_REFUND",
  "SUPPLIER_REFUND_REVERSAL",
  "MANUAL_IN",
  "MANUAL_OUT",
];
const movementLabels: Record<CashMovementType, string> = {
  SALE_PAYMENT: "Cobro de venta",
  SALE_PAYMENT_REVERSAL: "Reversión de cobro",
  SALE_REFUND: "Reembolso a cliente",
  SALE_REFUND_REVERSAL: "Reversión de reembolso",
  PURCHASE_PAYMENT: "Pago de compra",
  PURCHASE_PAYMENT_REVERSAL: "Reversión de pago de compra",
  SUPPLIER_REFUND: "Reembolso de proveedor",
  SUPPLIER_REFUND_REVERSAL: "Reversión de reembolso de proveedor",
  MANUAL_IN: "Entrada manual",
  MANUAL_OUT: "Salida manual",
};
const inflows = new Set<CashMovementType>([
  "SALE_PAYMENT",
  "SALE_REFUND_REVERSAL",
  "PURCHASE_PAYMENT_REVERSAL",
  "SUPPLIER_REFUND",
  "MANUAL_IN",
]);

function SessionBadge({ status }: { status: CashSession["status"] }) {
  return <Badge tone={status === "OPEN" ? "success" : "neutral"}>{status === "OPEN" ? "Abierta" : "Cerrada"}</Badge>;
}

function MovementReference({ row }: { row: CashMovement }) {
  const payment = row.payment;
  if (!payment) return <span>Manual</span>;
  let link: string | undefined;
  let document = "Pago";
  if (payment.saleId) { link = `/app/sales/${payment.saleId}`; document = "Venta"; }
  else if (payment.saleReturnId) { link = `/app/sales/returns/${payment.saleReturnId}`; document = "Devolución de venta"; }
  else if (payment.purchaseId) { link = `/app/purchasing/purchases/${payment.purchaseId}`; document = "Compra"; }
  else if (payment.purchaseReturnId) { link = `/app/purchasing/returns/${payment.purchaseReturnId}`; document = "Devolución de compra"; }
  const content = <><strong>{document} · Pago #{payment.number}</strong><small>{payment.externalReference || payment.paymentMethod?.name || row.paymentId}</small></>;
  return link ? <Link className="table-link" to={link}>{content}</Link> : <span>{content}</span>;
}

const movementColumns: ErpColumn<CashMovement>[] = [
  { key: "time", header: "Fecha y hora", cell: (row) => formatDateTime(row.createdAt) },
  { key: "type", header: "Movimiento", cell: (row) => <><strong>{movementLabels[row.type]}</strong><small>{row.type}</small></> },
  { key: "direction", header: "Dirección", cell: (row) => <Badge tone={inflows.has(row.type) ? "success" : "warning"}>{inflows.has(row.type) ? "Entrada" : "Salida"}</Badge> },
  { key: "amount", header: "Monto", cell: (row) => <strong>{formatMoney(row.amount)}</strong> },
  { key: "reference", header: "Referencia", cell: (row) => <MovementReference row={row} /> },
  { key: "session", header: "Sesión / caja", cell: (row) => <Link className="table-link" to={`/app/cash/sessions/${row.cashSessionId}`}><strong>{row.cashSession.cashRegister.code}</strong><small>{row.cashSessionId}</small></Link> },
  { key: "reason", header: "Razón / actor", cell: (row) => <><span>{row.reason || "—"}</span><small>{row.actorId}</small></> },
];

export function CashRegistersPage() {
  const { hasPermission } = useAuth();
  const filters = useUrlFilters();
  const [search, setSearch] = useState(filters.values.search ?? "");
  const params = { page: filters.page, limit: filters.limit, search: filters.values.search, active: filters.values.active };
  const list = useQuery({ queryKey: queryKeys.cashRegisters(params), queryFn: () => cashApi.registers(params) });
  const columns: ErpColumn<CashRegister>[] = [
    { key: "register", header: "Caja", cell: (row) => <Link className="table-link" to={`/app/cash/registers/${row.id}`}><strong>{row.code}</strong><small>{row.name}</small></Link> },
    { key: "description", header: "Descripción", cell: (row) => row.description || "—" },
    { key: "active", header: "Estado", cell: (row) => <StatusBadge active={row.active} /> },
  ];
  return <div className="page-stack">
    <PageHeader eyebrow="Caja" title="Cajas" description="Puntos físicos de caja con ciclo de vida e historial preservado." actions={hasPermission("cash-registers.manage") ? <Link className="button button--primary" to="/app/cash/registers/new">Nueva caja</Link> : undefined} />
    <form className="panel filter-bar" onSubmit={(event) => { event.preventDefault(); filters.update({ search }); }}>
      <Field label="Buscar" htmlFor="cash-register-search"><input id="cash-register-search" type="search" placeholder="Código o nombre" value={search} onChange={(event) => setSearch(event.target.value)} /></Field>
      <Field label="Estado" htmlFor="cash-register-active"><select id="cash-register-active" value={filters.values.active ?? ""} onChange={(event) => filters.update({ active: event.target.value })}><option value="">Todos</option><option value="true">Activas</option><option value="false">Inactivas</option></select></Field>
      <div className="filter-actions"><Button type="submit">Aplicar</Button><Button type="button" variant="ghost" onClick={() => { setSearch(""); filters.clear(); }}>Limpiar</Button></div>
    </form>
    <section className="panel"><ErpTable columns={columns} rows={list.data?.data} rowKey={(row) => row.id} loading={list.isLoading} error={list.error ? apiErrorMessage(list.error) : undefined} onRetry={() => void list.refetch()} emptyTitle="No se encontraron cajas" /><Pagination meta={list.data?.meta} onPageChange={(page) => filters.update({ page }, false)} /></section>
  </div>;
}

const emptyRegister: CashRegisterInput = { code: "", name: "", description: "", active: true };
export function CashRegisterFormPage() {
  const { id } = useParams();
  const detail = useQuery({ queryKey: queryKeys.cashRegister(id ?? "new"), queryFn: () => cashApi.register(id!), enabled: Boolean(id) });
  if (id && detail.isLoading) return <div className="panel">Cargando caja…</div>;
  if (id && detail.error) return <FormFeedback error={apiErrorMessage(detail.error)} />;
  return <CashRegisterEditor id={id} initial={detail.data} />;
}

function CashRegisterEditor({ id, initial }: { id?: string; initial?: CashRegister }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [form, setForm] = useState<CashRegisterInput>(() => initial ? { code: initial.code, name: initial.name, description: initial.description ?? "", active: initial.active } : emptyRegister);
  const mutation = useMutation({ mutationFn: (body: CashRegisterInput) => id ? cashApi.updateRegister(id, body) : cashApi.createRegister(body), onSuccess: async (row) => { client.setQueryData(queryKeys.cashRegister(row.id), row); await Promise.all([client.invalidateQueries({ queryKey: queryKeys.cashRegistersRoot }), invalidateCashIntegration(client)]); void navigate(`/app/cash/registers/${row.id}`, { replace: true }); } });
  return <div className="page-stack"><PageHeader eyebrow="Caja" title={id ? "Editar caja" : "Nueva caja"} description="La desactivación no elimina sesiones ni movimientos históricos." />
    <form className="panel erp-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate({ ...form, description: form.description || undefined }); }}>
      <FormFeedback error={mutation.error ? apiErrorMessage(mutation.error) : null} />
      <div className="form-grid">
        <Field label="Código" htmlFor="register-code" required><input id="register-code" required minLength={2} maxLength={60} pattern="[A-Za-z0-9][A-Za-z0-9._/-]*" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></Field>
        <Field label="Nombre" htmlFor="register-name" required><input id="register-name" required minLength={2} maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="Descripción" htmlFor="register-description"><textarea id="register-description" maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
        <label className="check-field"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />Caja activa</label>
      </div>
      <div className="form-actions"><Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancelar</Button><Button type="submit" loading={mutation.isPending}>Guardar caja</Button></div>
    </form>
  </div>;
}

export function CashRegisterDetailPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const [lifecycleConfirm, setLifecycleConfirm] = useState(false);
  const [opening, setOpening] = useState({ amount: "", notes: "" });
  const [openConfirm, setOpenConfirm] = useState(false);
  const detail = useQuery({ queryKey: queryKeys.cashRegister(id), queryFn: () => cashApi.register(id) });
  const current = useQuery({ queryKey: queryKeys.currentCashSession(id), queryFn: () => cashApi.currentSession(id), enabled: hasPermission("cash-sessions.read") });
  const lifecycle = useMutation({ mutationFn: (active: boolean) => cashApi.setRegisterActive(id, active), onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: queryKeys.cashRegister(id) }), client.invalidateQueries({ queryKey: queryKeys.cashRegistersRoot }), invalidateCashIntegration(client)]); setLifecycleConfirm(false); } });
  const open = useMutation({ mutationFn: () => cashApi.openSession(id, { openingAmount: opening.amount, notes: opening.notes || undefined }), onSuccess: async () => { setOpening({ amount: "", notes: "" }); setOpenConfirm(false); await Promise.all([client.invalidateQueries({ queryKey: queryKeys.currentCashSession(id) }), client.invalidateQueries({ queryKey: queryKeys.cashSessionsRoot }), invalidateCommercialSummary(client)]); } });
  if (detail.isLoading) return <div className="panel">Cargando caja…</div>;
  if (detail.error || !detail.data) return <FormFeedback error={apiErrorMessage(detail.error)} />;
  const row = detail.data;
  return <div className="page-stack"><PageHeader eyebrow="Caja" title={`${row.code} · ${row.name}`} description={row.description || "Caja física"} actions={<><Link className="button button--secondary" to={`/app/cash/sessions?cashRegisterId=${id}`}>Ver sesiones</Link>{hasPermission("cash-registers.manage") ? <><Link className="button button--secondary" to={`/app/cash/registers/${id}/edit`}>Editar</Link><Button variant={row.active ? "danger" : "primary"} onClick={() => setLifecycleConfirm(true)}>{row.active ? "Desactivar" : "Activar"}</Button></> : null}</>} />
    <section className="panel detail-grid"><div className="detail-card"><h2>Identidad</h2><dl><div><dt>Código</dt><dd>{row.code}</dd></div><div><dt>Nombre</dt><dd>{row.name}</dd></div><div><dt>Estado</dt><dd><StatusBadge active={row.active} /></dd></div></dl></div>
      <div className="detail-card"><h2>Sesión actual</h2>{!hasPermission("cash-sessions.read") ? <p className="muted">Sin permiso para consultar sesiones.</p> : current.isLoading ? <p>Cargando…</p> : current.data ? <dl><div><dt>Estado</dt><dd><SessionBadge status={current.data.status} /></dd></div><div><dt>Abierta</dt><dd>{formatDateTime(current.data.openedAt)}</dd></div><div><dt>Acción</dt><dd><Link className="table-link" to={`/app/cash/sessions/${current.data.id}`}>Abrir sesión</Link></dd></div></dl> : <p className="muted">No hay sesión abierta.</p>}</div></section>
    {row.active && hasPermission("cash-sessions.open") && !current.data ? <form className="panel erp-form" onSubmit={(event) => { event.preventDefault(); setOpenConfirm(true); }}><div className="section-heading"><div><h2>Abrir sesión</h2><p>El backend garantiza una sola sesión abierta por caja.</p></div></div><FormFeedback error={open.error ? apiErrorMessage(open.error) : null} /><div className="form-grid"><Field label="Efectivo inicial" htmlFor="opening-amount" required><input id="opening-amount" required inputMode="decimal" placeholder="0.00" value={opening.amount} onChange={(event) => setOpening({ ...opening, amount: event.target.value })} /></Field><Field label="Notas" htmlFor="opening-notes"><textarea id="opening-notes" maxLength={500} value={opening.notes} onChange={(event) => setOpening({ ...opening, notes: event.target.value })} /></Field></div><div className="form-actions"><Button type="submit" disabled={!isMoneyAtLeast(opening.amount, "0")}>Revisar apertura</Button></div></form> : null}
    <ConfirmDialog open={lifecycleConfirm} title={`${row.active ? "Desactivar" : "Activar"} caja`} description="El historial financiero permanecerá intacto." dangerous={row.active} loading={lifecycle.isPending} onCancel={() => setLifecycleConfirm(false)} onConfirm={() => lifecycle.mutate(!row.active)} />
    <ConfirmDialog open={openConfirm} title="Abrir sesión de caja" description={`Se abrirá con ${opening.amount ? formatMoney(opening.amount) : "el monto indicado"}. La validación final corresponde al backend.`} confirmLabel="Abrir sesión" loading={open.isPending} onCancel={() => setOpenConfirm(false)} onConfirm={() => open.mutate()} />
  </div>;
}

export function CashSessionsPage() {
  const filters = useUrlFilters();
  const params = { page: filters.page, limit: filters.limit, cashRegisterId: filters.values.cashRegisterId, status: filters.values.status, openedByActorId: filters.values.openedByActorId, openedFrom: filters.values.openedFrom ? `${filters.values.openedFrom}T00:00:00.000-06:00` : undefined, openedTo: filters.values.openedTo ? `${filters.values.openedTo}T23:59:59.999-06:00` : undefined };
  const list = useQuery({ queryKey: queryKeys.cashSessions(params), queryFn: () => cashApi.sessions(params) });
  const columns: ErpColumn<CashSession>[] = [
    { key: "register", header: "Caja", cell: (row) => <Link className="table-link" to={`/app/cash/sessions/${row.id}`}><strong>{row.cashRegister.code}</strong><small>{row.cashRegister.name}</small></Link> },
    { key: "status", header: "Estado", cell: (row) => <SessionBadge status={row.status} /> },
    { key: "opened", header: "Apertura", cell: (row) => <>{formatDateTime(row.openedAt)}<small>{row.openedByActorId}</small></> },
    { key: "opening", header: "Inicial", cell: (row) => formatMoney(row.openingAmount) },
    { key: "closed", header: "Cierre", cell: (row) => row.closedAt ? <>{formatDateTime(row.closedAt)}<small>{row.closedByActorId}</small></> : "—" },
    { key: "difference", header: "Diferencia", cell: (row) => row.differenceAmount != null ? formatMoney(row.differenceAmount) : "—" },
  ];
  return <div className="page-stack"><PageHeader eyebrow="Caja" title="Sesiones" description="Aperturas y cierres paginados por el servidor." />
    <section className="panel filter-bar"><CashRegisterSelector id="session-register" value={filters.values.cashRegisterId ?? ""} onChange={(cashRegisterId) => filters.update({ cashRegisterId })} /><Field label="Estado" htmlFor="session-status"><select id="session-status" value={filters.values.status ?? ""} onChange={(event) => filters.update({ status: event.target.value })}><option value="">Todos</option><option value="OPEN">Abiertas</option><option value="CLOSED">Cerradas</option></select></Field><Field label="Abierta desde" htmlFor="session-from"><input id="session-from" type="date" value={filters.values.openedFrom ?? ""} onChange={(event) => filters.update({ openedFrom: event.target.value })} /></Field><Field label="Abierta hasta" htmlFor="session-to"><input id="session-to" type="date" value={filters.values.openedTo ?? ""} onChange={(event) => filters.update({ openedTo: event.target.value })} /></Field><Field label="Actor" htmlFor="session-actor"><input id="session-actor" value={filters.values.openedByActorId ?? ""} onChange={(event) => filters.update({ openedByActorId: event.target.value })} /></Field><div className="filter-actions"><Button variant="ghost" onClick={filters.clear}>Limpiar</Button></div></section>
    <section className="panel"><ErpTable columns={columns} rows={list.data?.data} rowKey={(row) => row.id} loading={list.isLoading} error={list.error ? apiErrorMessage(list.error) : undefined} onRetry={() => void list.refetch()} emptyTitle="No se encontraron sesiones" /><Pagination meta={list.data?.meta} onPageChange={(page) => filters.update({ page }, false)} /></section>
  </div>;
}

function ManualMovementForm({ sessionId, onCreated }: { sessionId: string; onCreated: () => Promise<void> }) {
  const [form, setForm] = useState<{ type: "MANUAL_IN" | "MANUAL_OUT"; amount: string; reason: string }>({ type: "MANUAL_IN", amount: "", reason: "" });
  const [confirm, setConfirm] = useState(false);
  const mutation = useMutation({ mutationFn: () => cashApi.createMovement(sessionId, form), onSuccess: async () => { setConfirm(false); setForm({ type: "MANUAL_IN", amount: "", reason: "" }); await onCreated(); } });
  return <form className="panel erp-form" onSubmit={(event) => { event.preventDefault(); setConfirm(true); }}><div className="section-heading"><div><h2>Movimiento manual</h2><p>{form.type === "MANUAL_IN" ? "Este movimiento aumenta el efectivo esperado." : "Este movimiento reduce el efectivo esperado."}</p></div></div><FormFeedback error={mutation.error ? apiErrorMessage(mutation.error) : null} /><div className="form-grid"><Field label="Tipo" htmlFor="manual-type" required><select id="manual-type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as typeof form.type })}><option value="MANUAL_IN">Entrada manual</option><option value="MANUAL_OUT">Salida manual</option></select></Field><Field label="Monto" htmlFor="manual-amount" required><input id="manual-amount" required inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></Field><Field label="Razón" htmlFor="manual-reason" required><textarea id="manual-reason" required minLength={3} maxLength={500} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></Field></div><div className="form-actions"><Button type="submit" disabled={!isPositiveMoneyAtMost(form.amount) || form.reason.trim().length < 3}>Revisar movimiento</Button></div><ConfirmDialog open={confirm} title={form.type === "MANUAL_IN" ? "Confirmar entrada manual" : "Confirmar salida manual"} description={`${movementLabels[form.type]} por ${form.amount ? formatMoney(form.amount) : "el monto indicado"}. El backend validará la disponibilidad física.`} confirmLabel="Registrar movimiento" dangerous={form.type === "MANUAL_OUT"} loading={mutation.isPending} onCancel={() => setConfirm(false)} onConfirm={() => mutation.mutate()} /></form>;
}

export function CashSessionDetailPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const [movementPage, setMovementPage] = useState(1);
  const [closeForm, setCloseForm] = useState({ countedAmount: "", notes: "" });
  const [closeConfirm, setCloseConfirm] = useState(false);
  const canReadMovements = hasPermission("cash-movements.read");
  const summary = useQuery({ queryKey: queryKeys.cashSessionSummary(id), queryFn: () => cashApi.summary(id), enabled: canReadMovements });
  const basic = useQuery({ queryKey: queryKeys.cashSession(id), queryFn: () => cashApi.session(id), enabled: !canReadMovements });
  const movementParams = { cashSessionId: id, page: movementPage, limit: 20 };
  const movements = useQuery({ queryKey: queryKeys.cashMovements(movementParams), queryFn: () => cashApi.movements(movementParams), enabled: canReadMovements });
  const close = useMutation({ mutationFn: () => cashApi.closeSession(id, { countedAmount: closeForm.countedAmount, notes: closeForm.notes || undefined }), onSuccess: async () => { setCloseConfirm(false); await Promise.all([client.invalidateQueries({ queryKey: queryKeys.cashSessionSummary(id) }), client.invalidateQueries({ queryKey: queryKeys.cashSession(id) }), client.invalidateQueries({ queryKey: queryKeys.cashSessionsRoot }), client.invalidateQueries({ queryKey: queryKeys.currentCashSession(summary.data?.cashRegisterId ?? basic.data?.cashRegisterId ?? "") }), invalidateCommercialSummary(client)]); } });
  const loading = canReadMovements ? summary.isLoading : basic.isLoading;
  const error = canReadMovements ? summary.error : basic.error;
  const row = canReadMovements ? summary.data : basic.data;
  if (loading) return <div className="panel">Cargando sesión…</div>;
  if (error || !row) return <FormFeedback error={apiErrorMessage(error)} />;
  const expectedCash = canReadMovements
    ? summary.data?.expectedCash
    : basic.data?.expectedAmount;
  const refresh = async () => { await invalidateCashIntegration(client); };
  return <div className="page-stack"><PageHeader eyebrow="Caja" title={`Sesión · ${row.cashRegister.code}`} description={`Abierta ${formatDateTime(row.openedAt)}`} actions={<SessionBadge status={row.status} />} />
    <section className="commercial-summary-grid panel"><span>Efectivo inicial<strong>{formatMoney(row.openingAmount)}</strong></span><span>Efectivo esperado<strong>{expectedCash != null ? formatMoney(expectedCash) : "Requiere permiso de movimientos"}</strong></span>{row.status === "CLOSED" ? <><span>Efectivo contado<strong>{formatMoney(row.countedAmount ?? "0")}</strong></span><span>Diferencia<strong>{formatMoney(row.differenceAmount ?? "0")}</strong></span></> : null}</section>
    <section className="panel detail-grid"><div className="detail-card"><h2>Apertura</h2><dl><div><dt>Caja</dt><dd><Link className="table-link" to={`/app/cash/registers/${row.cashRegisterId}`}>{row.cashRegister.code} · {row.cashRegister.name}</Link></dd></div><div><dt>Actor</dt><dd>{row.openedByActorId}</dd></div><div><dt>Notas</dt><dd>{row.openingNotes || "—"}</dd></div></dl></div>{row.status === "CLOSED" ? <div className="detail-card"><h2>Cierre</h2><dl><div><dt>Fecha</dt><dd>{formatDateTime(row.closedAt!)}</dd></div><div><dt>Actor</dt><dd>{row.closedByActorId}</dd></div><div><dt>Notas</dt><dd>{row.closingNotes || "—"}</dd></div></dl></div> : null}</section>
    {row.status === "OPEN" && hasPermission("cash-movements.create") ? <ManualMovementForm sessionId={id} onCreated={refresh} /> : null}
    {row.status === "OPEN" && hasPermission("cash-sessions.close") ? <form className="panel erp-form" onSubmit={(event) => { event.preventDefault(); setCloseConfirm(true); }}><div className="section-heading"><div><h2>Cerrar sesión</h2><p>El backend fija la diferencia final y bloquea movimientos posteriores.</p></div></div><FormFeedback error={close.error ? apiErrorMessage(close.error) : null} /><div className="form-grid"><Field label="Efectivo contado" htmlFor="counted-amount" required><input id="counted-amount" required inputMode="decimal" value={closeForm.countedAmount} onChange={(event) => setCloseForm({ ...closeForm, countedAmount: event.target.value })} /></Field><Field label="Notas de cierre" htmlFor="closing-notes" hint="Obligatorias en backend cuando existe diferencia."><textarea id="closing-notes" maxLength={500} value={closeForm.notes} onChange={(event) => setCloseForm({ ...closeForm, notes: event.target.value })} /></Field></div><div className="form-actions"><Button type="submit" disabled={!isMoneyAtLeast(closeForm.countedAmount, "0")}>Revisar cierre</Button></div><ConfirmDialog open={closeConfirm} title="Cerrar sesión de caja" description="Cerrar finaliza esta sesión e impide nuevos movimientos. El efectivo esperado y la diferencia final provienen del backend." confirmLabel="Cerrar sesión" dangerous loading={close.isPending} onCancel={() => setCloseConfirm(false)} onConfirm={() => close.mutate()} /></form> : null}
    {canReadMovements ? <section className="panel"><div className="section-heading"><div><h2>Movimientos</h2><p>Ledger inmutable, paginado y ordenado por el backend.</p></div><Link className="button button--secondary" to={`/app/cash/movements?cashSessionId=${id}`}>Ver ledger completo</Link></div><ErpTable columns={movementColumns} rows={movements.data?.data} rowKey={(item) => item.id} loading={movements.isLoading} error={movements.error ? apiErrorMessage(movements.error) : undefined} onRetry={() => void movements.refetch()} emptyTitle="Esta sesión no tiene movimientos" /><Pagination meta={movements.data?.meta} onPageChange={setMovementPage} /></section> : null}
  </div>;
}

export function CashMovementsPage() {
  const filters = useUrlFilters();
  const params = { page: filters.page, limit: filters.limit, cashSessionId: filters.values.cashSessionId, cashRegisterId: filters.values.cashRegisterId, type: filters.values.type, paymentId: filters.values.paymentId, reference: filters.values.reference, createdFrom: filters.values.createdFrom ? `${filters.values.createdFrom}T00:00:00.000-06:00` : undefined, createdTo: filters.values.createdTo ? `${filters.values.createdTo}T23:59:59.999-06:00` : undefined };
  const list = useQuery({ queryKey: queryKeys.cashMovements(params), queryFn: () => cashApi.movements(params) });
  return <div className="page-stack"><PageHeader eyebrow="Caja" title="Movimientos de efectivo" description="Ledger inmutable con filtros y paginación del servidor." />
    <section className="panel filter-bar"><CashRegisterSelector id="movement-register" value={filters.values.cashRegisterId ?? ""} onChange={(cashRegisterId) => filters.update({ cashRegisterId })} /><Field label="Tipo" htmlFor="movement-type"><select id="movement-type" value={filters.values.type ?? ""} onChange={(event) => filters.update({ type: event.target.value })}><option value="">Todos</option>{MOVEMENT_TYPES.map((type) => <option key={type} value={type}>{movementLabels[type]}</option>)}</select></Field><Field label="Sesión" htmlFor="movement-session"><input id="movement-session" placeholder="UUID de sesión" value={filters.values.cashSessionId ?? ""} onChange={(event) => filters.update({ cashSessionId: event.target.value })} /></Field><Field label="Pago o referencia" htmlFor="movement-reference"><input id="movement-reference" placeholder="UUID, número o referencia externa" value={filters.values.reference ?? ""} onChange={(event) => filters.update({ reference: event.target.value })} /></Field><Field label="Desde" htmlFor="movement-from"><input id="movement-from" type="date" value={filters.values.createdFrom ?? ""} onChange={(event) => filters.update({ createdFrom: event.target.value })} /></Field><Field label="Hasta" htmlFor="movement-to"><input id="movement-to" type="date" value={filters.values.createdTo ?? ""} onChange={(event) => filters.update({ createdTo: event.target.value })} /></Field><div className="filter-actions"><Button variant="ghost" onClick={filters.clear}>Limpiar</Button></div></section>
    <section className="panel"><ErpTable columns={movementColumns} rows={list.data?.data} rowKey={(row) => row.id} loading={list.isLoading} error={list.error ? apiErrorMessage(list.error) : undefined} onRetry={() => void list.refetch()} emptyTitle="No se encontraron movimientos" /><Pagination meta={list.data?.meta} onPageChange={(page) => filters.update({ page }, false)} ariaLabel="Paginación de movimientos de efectivo" /></section>
  </div>;
}
