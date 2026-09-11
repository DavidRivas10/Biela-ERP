import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { cashApi } from "../api/cash-api";
import { salesApi } from "../api/sales-api";
import { salesFinanceApi } from "../api/sales-finance-api";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { Field } from "../components/Field";
import { FormFeedback } from "../components/FormFeedback";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { queryKeys } from "../query/query-keys";
import {
  invalidateCashIntegration,
  invalidateCommercialSummary,
} from "../query/invalidation";
import { formatDateTime, formatMoney, isMoneyAtLeast } from "../utils/formatters";
import { apiErrorMessage } from "../utils/api-error";

const REGISTER_KEY = "biela.pos.register";

function rememberRegister(id: string) {
  try {
    if (id) localStorage.setItem(REGISTER_KEY, id);
    else localStorage.removeItem(REGISTER_KEY);
  } catch {
    /* private mode — the picker still works for this view */
  }
}
function recallRegister(): string {
  try {
    return localStorage.getItem(REGISTER_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Plain, once, at the top: what a cash session is. */
const SESSION_EXPLAINER =
  "Una sesión de caja es tu turno: la abrís contando el efectivo con el que empezás y la cerrás contando el efectivo al final. El sistema te dice si cuadra.";

export function PosPage() {
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const canReadSessions = hasPermission("cash-sessions.read");
  const canOpen = hasPermission("cash-sessions.open");
  const canClose = hasPermission("cash-sessions.close");
  const canReadMovements = hasPermission("cash-movements.read");

  const [registerId, setRegisterId] = useState(recallRegister);
  const [opening, setOpening] = useState("");
  const [openError, setOpenError] = useState<string | null>(null);
  const [counted, setCounted] = useState("");
  const [closeNotes, setCloseNotes] = useState("");

  const registers = useQuery({
    queryKey: queryKeys.cashRegisters({ active: true, page: 1, limit: 50 }),
    queryFn: () => cashApi.registers({ active: true, page: 1, limit: 50 }),
    enabled: hasPermission("cash-registers.read"),
  });
  const registerList = registers.data?.data ?? [];
  const effectiveRegisterId =
    registerId || (registerList.length === 1 ? registerList[0].id : "");

  const session = useQuery({
    queryKey: queryKeys.currentCashSession(effectiveRegisterId || "none"),
    queryFn: () => cashApi.currentSession(effectiveRegisterId),
    enabled: Boolean(effectiveRegisterId) && canReadSessions,
  });
  const openSession = session.data;
  const summary = useQuery({
    queryKey: queryKeys.cashSessionSummary(openSession?.id ?? "none"),
    queryFn: () => cashApi.summary(openSession!.id),
    enabled: Boolean(openSession?.id) && canReadMovements,
  });

  const pending = useQuery({
    queryKey: queryKeys.receivables({ pos: true, page: 1, limit: 8 }),
    queryFn: () => salesFinanceApi.receivables({ page: 1, limit: 8 }),
    enabled: hasPermission("sales.read"),
  });
  const openAccounts = useQuery({
    queryKey: queryKeys.sales({ pos: "open-accounts" }),
    queryFn: () =>
      salesApi.list({
        status: "DRAFT",
        hasAccountLabel: true,
        page: 1,
        limit: 8,
      }),
    enabled: hasPermission("sales.read"),
  });

  const open = useMutation({
    mutationFn: () =>
      cashApi.openSession(effectiveRegisterId, { openingAmount: opening }),
    onSuccess: async () => {
      setOpening("");
      setOpenError(null);
      await Promise.all([
        client.invalidateQueries({
          queryKey: queryKeys.currentCashSession(effectiveRegisterId),
        }),
        client.invalidateQueries({ queryKey: queryKeys.cashSessionsRoot }),
        invalidateCommercialSummary(client),
      ]);
    },
    onError: (error) => setOpenError(apiErrorMessage(error)),
  });
  const close = useMutation({
    mutationFn: () =>
      cashApi.closeSession(openSession!.id, {
        countedAmount: counted,
        notes: closeNotes || undefined,
      }),
    onSuccess: async () => {
      setCounted("");
      setCloseNotes("");
      await Promise.all([
        client.invalidateQueries({
          queryKey: queryKeys.currentCashSession(effectiveRegisterId),
        }),
        client.invalidateQueries({ queryKey: queryKeys.cashSessionsRoot }),
        invalidateCashIntegration(client),
        invalidateCommercialSummary(client),
      ]);
    },
  });

  const pendingRows = pending.data?.data ?? [];
  const accountRows = openAccounts.data?.data ?? [];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Vender"
        title="Punto de venta"
        description="Tu pantalla para cobrar. Elegí tu caja, abrí el turno y desde acá registrás las ventas y los cobros del día."
        actions={
          hasPermission("sales.create") ? (
            <Link className="button button--primary" to="/app/sales/new">
              Nueva venta rápida
            </Link>
          ) : undefined
        }
      />

      {/* --- Turno de caja --- */}
      <section className="panel pos-shift">
        <div className="section-heading">
          <div>
            <h2>Tu caja</h2>
            <p>{SESSION_EXPLAINER}</p>
          </div>
        </div>

        {!hasPermission("cash-registers.read") ? (
          <p className="muted">Tu usuario no maneja caja.</p>
        ) : registers.isLoading ? (
          <LoadingState label="Buscando cajas" />
        ) : registerList.length === 0 ? (
          <EmptyState title="No hay cajas configuradas">
            Pedile a un administrador que cree al menos una caja en Dinero →
            Cajas.
          </EmptyState>
        ) : (
          <>
            {registerList.length > 1 ? (
              <Field label="¿En qué caja estás?" htmlFor="pos-register">
                <select
                  id="pos-register"
                  value={effectiveRegisterId}
                  onChange={(event) => {
                    setRegisterId(event.target.value);
                    rememberRegister(event.target.value);
                  }}
                >
                  <option value="">Elegí tu caja</option>
                  {registerList.map((register) => (
                    <option key={register.id} value={register.id}>
                      {register.code} · {register.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {!effectiveRegisterId ? (
              <p className="muted">Elegí tu caja para empezar.</p>
            ) : !canReadSessions ? (
              <p className="muted">
                No tenés permiso para ver el turno de esta caja.
              </p>
            ) : session.isLoading ? (
              <LoadingState label="Consultando el turno" />
            ) : openSession ? (
              <div className="pos-shift__open">
                <div className="pos-shift__stats">
                  <Badge tone="success">Caja abierta</Badge>
                  <span>
                    Desde <strong>{formatDateTime(openSession.openedAt)}</strong>
                  </span>
                  <span>
                    Efectivo inicial{" "}
                    <strong>{formatMoney(openSession.openingAmount)}</strong>
                  </span>
                  {summary.data ? (
                    <span>
                      Efectivo que debería haber ahora{" "}
                      <strong>{formatMoney(summary.data.expectedCash)}</strong>
                    </span>
                  ) : null}
                </div>
                <div className="row-actions">
                  <Link
                    className="button button--secondary"
                    to={`/app/cash/sessions/${openSession.id}`}
                  >
                    Ver detalle y corte parcial
                  </Link>
                </div>
                {canClose ? (
                  <form
                    className="pos-shift__close"
                    onSubmit={(event) => {
                      event.preventDefault();
                      close.mutate();
                    }}
                  >
                    <h3>Cerrar la caja</h3>
                    <p className="muted">
                      Contá todo el efectivo que hay en la caja ahora y ponelo
                      acá. Si no cuadra con lo esperado, explicá por qué en las
                      notas.
                    </p>
                    <FormFeedback
                      error={close.error ? apiErrorMessage(close.error) : null}
                    />
                    <div className="form-grid">
                      <Field
                        label="Efectivo contado"
                        htmlFor="pos-counted"
                        required
                      >
                        <input
                          id="pos-counted"
                          required
                          inputMode="decimal"
                          placeholder="0.00"
                          value={counted}
                          onChange={(event) => setCounted(event.target.value)}
                        />
                      </Field>
                      <Field
                        label="Notas de cierre"
                        htmlFor="pos-close-notes"
                        hint="Obligatorias si hay diferencia."
                      >
                        <textarea
                          id="pos-close-notes"
                          maxLength={500}
                          value={closeNotes}
                          onChange={(event) =>
                            setCloseNotes(event.target.value)
                          }
                        />
                      </Field>
                    </div>
                    <div className="form-actions">
                      <Button
                        type="submit"
                        variant="danger"
                        loading={close.isPending}
                        disabled={!isMoneyAtLeast(counted, "0")}
                      >
                        Cerrar caja
                      </Button>
                    </div>
                  </form>
                ) : null}
              </div>
            ) : canOpen ? (
              <form
                className="pos-shift__close"
                onSubmit={(event) => {
                  event.preventDefault();
                  open.mutate();
                }}
              >
                <h3>Abrí tu caja</h3>
                <p className="muted">
                  Contá el efectivo con el que arrancás el turno y ponelo acá.
                </p>
                <FormFeedback error={openError} />
                <div className="form-grid">
                  <Field
                    label="Efectivo inicial"
                    htmlFor="pos-opening"
                    required
                  >
                    <input
                      id="pos-opening"
                      required
                      inputMode="decimal"
                      placeholder="0.00"
                      value={opening}
                      onChange={(event) => setOpening(event.target.value)}
                    />
                  </Field>
                </div>
                <div className="form-actions">
                  <Button
                    type="submit"
                    loading={open.isPending}
                    disabled={!isMoneyAtLeast(opening, "0")}
                  >
                    Abrir caja
                  </Button>
                </div>
              </form>
            ) : (
              <p className="muted">
                Esta caja no tiene un turno abierto. Pedile a quien corresponda
                que la abra.
              </p>
            )}
          </>
        )}
      </section>

      {/* --- Ventas por cobrar --- */}
      {hasPermission("sales.read") ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Ventas por cobrar</h2>
              <p>
                Ventas confirmadas que todavía no están pagadas por completo.
              </p>
            </div>
            <Link
              className="button button--ghost"
              to="/app/commercial/receivables"
            >
              Ver todas
            </Link>
          </div>
          {pending.isLoading ? (
            <LoadingState label="Buscando ventas por cobrar" />
          ) : pendingRows.length === 0 ? (
            <EmptyState title="Nada pendiente de cobro">
              Todas las ventas confirmadas están pagadas. ¡Al día!
            </EmptyState>
          ) : (
            <ul className="pos-list">
              {pendingRows.map((doc) => (
                <li key={doc.id}>
                  <div>
                    <strong>
                      Venta #{doc.number}
                      {doc.overdue ? (
                        <Badge tone="danger">Vencida</Badge>
                      ) : null}
                    </strong>
                    <small>
                      {doc.walkIn
                        ? "Mostrador"
                        : `${doc.customer?.name ?? "Cliente"}`}{" "}
                      · Debe {formatMoney(doc.outstandingAmount)} de{" "}
                      {formatMoney(doc.total)}
                    </small>
                  </div>
                  {hasPermission("payments.create") ? (
                    <Link
                      className="button button--primary"
                      to={`/app/sales/${doc.id}/payments`}
                    >
                      Cobrar
                    </Link>
                  ) : (
                    <Link
                      className="button button--secondary"
                      to={`/app/sales/${doc.id}`}
                    >
                      Ver venta
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* --- Cuentas abiertas --- */}
      {hasPermission("sales.read") ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Cuentas abiertas</h2>
              <p>
                Ventas sin cerrar a las que se les van sumando piezas durante el
                día.
              </p>
            </div>
          </div>
          {openAccounts.isLoading ? (
            <LoadingState label="Buscando cuentas abiertas" />
          ) : accountRows.length === 0 ? (
            <EmptyState title="No hay cuentas abiertas">
              Cuando abras una cuenta desde una venta, aparecerá acá para
              seguir sumándole piezas y cerrarla.
            </EmptyState>
          ) : (
            <ul className="pos-list">
              {accountRows.map((sale) => (
                <li key={sale.id}>
                  <div>
                    <strong>{sale.accountLabel}</strong>
                    <small>
                      Cuenta #{sale.number} · {sale._count?.items ?? 0} productos
                      · {formatMoney(sale.total)}
                    </small>
                  </div>
                  <Link
                    className="button button--secondary"
                    to={`/app/sales/${sale.id}/edit`}
                  >
                    Seguir cargando
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
