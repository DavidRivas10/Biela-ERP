import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { cashApi } from "../api/cash-api";
import { getCommercialSummary } from "../api/commercial-api";
import { useAuth } from "../auth/AuthContext";
import { hasPermission } from "../auth/permissions";
import { Alert } from "../components/Alert";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { queryKeys } from "../query/query-keys";
import {
  formatBusinessDate,
  formatDateTime,
  formatMoney,
  pluralize,
} from "../utils/formatters";

function Metric({
  label,
  value,
  detail,
  to,
  linkLabel,
}: {
  label: string;
  value: string;
  detail: string;
  to?: string;
  linkLabel?: string;
}) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      {to && linkLabel ? (
        <Link className="metric-card__link" to={to}>
          {linkLabel} →
        </Link>
      ) : null}
    </article>
  );
}

interface QuickAction {
  label: string;
  to: string;
  permission: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Registrar una venta", to: "/app/sales/new", permission: "sales.create" },
  {
    label: "Registrar una compra",
    to: "/app/purchasing/purchases/new",
    permission: "purchases.create",
  },
  {
    label: "Abrir o cerrar caja",
    to: "/app/cash/sessions",
    permission: "cash-sessions.open",
  },
  {
    label: "Cobrar a un cliente",
    to: "/app/commercial/receivables",
    permission: "commercial-receivables.read",
  },
  {
    label: "Agregar un producto",
    to: "/app/catalog/products/new",
    permission: "products.create",
  },
  {
    label: "Consultar inventario",
    to: "/app/inventory",
    permission: "inventory.read",
  },
];

export function DashboardPage() {
  const { user } = useAuth();
  const canReadSummary = hasPermission(user, "commercial-summary.read");
  const canReadCashSessions = hasPermission(user, "cash-sessions.read");
  const actions = QUICK_ACTIONS.filter((action) =>
    hasPermission(user, action.permission),
  ).slice(0, 5);

  const summary = useQuery({
    queryKey: queryKeys.commercialSummary,
    queryFn: getCommercialSummary,
    enabled: canReadSummary,
    retry: false,
  });
  const recentClosed = useQuery({
    queryKey: queryKeys.cashSessions({
      status: "CLOSED",
      page: 1,
      limit: 6,
      dashboard: true,
    }),
    queryFn: () => cashApi.sessions({ status: "CLOSED", page: 1, limit: 6 }),
    enabled: canReadCashSessions,
    retry: false,
  });

  const openSessions = summary.data?.cash.openSessionCount ?? 0;
  const closedShifts = recentClosed.data?.data ?? [];

  return (
    <section className="page-section dashboard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Panel del día</p>
          <h1>Hola, {user?.firstName || "equipo"}</h1>
          <p>Lo que necesitas ver de la operación de hoy.</p>
        </div>
        {summary.data ? (
          <span>
            Fecha de negocio: {formatBusinessDate(summary.data.businessDate)}
          </span>
        ) : null}
      </div>

      {actions.length > 0 ? (
        <section aria-labelledby="quick-actions-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Empezar</p>
              <h2 id="quick-actions-title">Qué puedes hacer ahora</h2>
            </div>
          </div>
          <div className="action-grid">
            {actions.map((action) => (
              <Link
                className="action-card"
                to={action.to}
                key={action.to}
              >
                <span>{action.label}</span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {canReadSummary ? (
        <section aria-labelledby="today-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Tu día</p>
              <h2 id="today-title">Cómo va hoy</h2>
            </div>
          </div>
          {summary.isPending ? (
            <LoadingState label="Consultando el resumen del día" />
          ) : null}
          {summary.isError ? (
            <ErrorState
              title="El resumen comercial no está disponible"
              message="Los demás módulos siguen accesibles según tus permisos."
              onRetry={() => void summary.refetch()}
            />
          ) : null}
          {summary.data ? (
            <>
              <div className="metrics-grid">
                <Metric
                  label="Vendido hoy"
                  value={formatMoney(summary.data.sales.today.total)}
                  detail={`${pluralize(
                    summary.data.sales.today.count,
                    "venta confirmada",
                    "ventas confirmadas",
                  )} hoy`}
                  to="/app/sales"
                  linkLabel="Ver ventas"
                />
                <Metric
                  label="Caja"
                  value={
                    openSessions > 0
                      ? openSessions === 1
                        ? "Abierta"
                        : `${openSessions} abiertas`
                      : "Cerrada"
                  }
                  detail={
                    openSessions > 0
                      ? `Efectivo esperado en caja: ${formatMoney(summary.data.cash.expectedCash)}`
                      : "Nadie tiene una sesión de caja abierta ahora"
                  }
                  to="/app/cash/sessions"
                  linkLabel={openSessions > 0 ? "Ver sesión" : "Abrir caja"}
                />
                <Metric
                  label="Te deben (por cobrar)"
                  value={formatMoney(
                    summary.data.receivables.outstandingAmount,
                  )}
                  detail={`${pluralize(
                    summary.data.receivables.overdueCount,
                    "venta vencida",
                    "ventas vencidas",
                  )} · ${formatMoney(summary.data.receivables.overdueAmount)} atrasado`}
                  to="/app/commercial/receivables"
                  linkLabel="Cobrar"
                />
                <Metric
                  label="Debes (por pagar)"
                  value={formatMoney(summary.data.payables.outstandingAmount)}
                  detail={pluralize(
                    summary.data.payables.overdueCount,
                    "factura de proveedor vencida",
                    "facturas de proveedor vencidas",
                  )}
                  to="/app/commercial/payables"
                  linkLabel="Ver pagos"
                />
              </div>
              <p className="data-note">
                Son montos operativos del día calculados por el sistema. No son
                utilidad, costo de venta ni estados contables.
              </p>
            </>
          ) : null}
        </section>
      ) : (
        <Alert tone="info" title="No ves el resumen del día">
          Tu usuario no tiene permiso para el resumen comercial. El resto de los
          módulos funciona normal según tus permisos.
        </Alert>
      )}

      {canReadCashSessions ? (
        <section aria-labelledby="shift-cuts-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Cortes de turno</p>
              <h2 id="shift-cuts-title">Últimos cierres de caja</h2>
            </div>
            <Link className="button button--ghost" to="/app/cash/sessions">
              Ver todos
            </Link>
          </div>
          {recentClosed.isPending ? (
            <LoadingState label="Consultando los últimos cierres de caja" />
          ) : recentClosed.isError ? (
            <ErrorState
              title="No se pudieron cargar los cierres de caja"
              message="El resto del panel sigue disponible."
              onRetry={() => void recentClosed.refetch()}
            />
          ) : closedShifts.length === 0 ? (
            <EmptyState title="Todavía no hay cierres de caja">
              Cuando alguien cierre una sesión de caja, el corte del turno
              aparece acá con lo esperado, lo contado y la diferencia.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Caja</th>
                    <th>Cerró</th>
                    <th>Fecha</th>
                    <th>Esperado</th>
                    <th>Contado</th>
                    <th>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {closedShifts.map((session) => (
                    <tr key={session.id}>
                      <td>
                        <Link
                          className="table-link"
                          to={`/app/cash/sessions/${session.id}`}
                        >
                          {session.cashRegister.code}
                        </Link>
                      </td>
                      <td>{session.closedByActorId ?? "—"}</td>
                      <td>
                        {session.closedAt
                          ? formatDateTime(session.closedAt)
                          : "—"}
                      </td>
                      <td>{formatMoney(session.expectedAmount ?? "0")}</td>
                      <td>{formatMoney(session.countedAmount ?? "0")}</td>
                      <td>
                        {session.differenceAmount != null
                          ? formatMoney(session.differenceAmount)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </section>
  );
}
