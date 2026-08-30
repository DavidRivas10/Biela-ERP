import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { cashApi } from "../api/cash-api";
import { getCommercialSummary } from "../api/commercial-api";
import { getSystemHealth } from "../api/system-api";
import { useAuth } from "../auth/AuthContext";
import { hasPermission } from "../auth/permissions";
import { Alert } from "../components/Alert";
import { Badge } from "../components/Badge";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { visibleNavigation } from "../layout/navigation";
import { queryKeys } from "../query/query-keys";
import {
  formatBusinessDate,
  formatDateTime,
  formatMoney,
} from "../utils/formatters";

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const canReadSummary = hasPermission(user, "commercial-summary.read");
  const canReadCashSessions = hasPermission(user, "cash-sessions.read");
  const quickAccess = visibleNavigation(user)
    .flatMap((group) => group.items)
    .filter((item) => item.path !== "/app/dashboard")
    .slice(0, 4);

  const health = useQuery({
    queryKey: ["system-health"],
    queryFn: getSystemHealth,
    retry: 1,
    refetchInterval: 60_000,
  });
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
    queryFn: () =>
      cashApi.sessions({ status: "CLOSED", page: 1, limit: 6 }),
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
                  label="Venta de hoy"
                  value={formatMoney(summary.data.sales.today.total)}
                  detail={`${summary.data.sales.today.count} ventas confirmadas`}
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
                      ? `Efectivo esperado ${formatMoney(summary.data.cash.expectedCash)}`
                      : "No hay sesión de caja abierta"
                  }
                />
                <Metric
                  label="Cuentas por cobrar"
                  value={formatMoney(
                    summary.data.receivables.outstandingAmount,
                  )}
                  detail={`${summary.data.receivables.overdueCount} vencidas · ${formatMoney(summary.data.receivables.overdueAmount)}`}
                />
                <Metric
                  label="Cuentas por pagar"
                  value={formatMoney(summary.data.payables.outstandingAmount)}
                  detail={`${summary.data.payables.overdueCount} vencidas`}
                />
              </div>
              <p className="data-note">
                Valores operativos derivados por el backend; no representan
                utilidad, COGS ni estados contables.
              </p>
            </>
          ) : null}
        </section>
      ) : (
        <Alert tone="info" title="Resumen comercial restringido">
          Tu rol no incluye <code>commercial-summary.read</code>. No se realizó
          ninguna solicitud a ese endpoint.
        </Alert>
      )}

      {canReadCashSessions && closedShifts.length > 0 ? (
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
        </section>
      ) : null}

      {quickAccess.length > 0 ? (
        <section aria-labelledby="quick-access-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Según tus permisos</p>
              <h2 id="quick-access-title">Accesos rápidos</h2>
            </div>
          </div>
          <div className="quick-grid">
            {quickAccess.map((item) => (
              <Link className="quick-link" to={item.path} key={item.path}>
                <span className="nav-link__icon" aria-hidden="true">
                  {item.short}
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <small>Ir al módulo</small>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <details className="system-details">
        <summary>
          Estado técnico de la plataforma
          {health.data ? (
            <Badge
              tone={health.data.status === "ok" ? "success" : "warning"}
            >
              {health.data.status === "ok" ? "Operativo" : "Degradado"}
            </Badge>
          ) : null}
        </summary>
        <div className="system-details__body">
          <p className="muted">
            Información de infraestructura para diagnóstico. No es un dato de
            negocio.
          </p>
          {health.isPending ? (
            <LoadingState label="Consultando servicios" />
          ) : null}
          {health.isError ? (
            <ErrorState
              title="No pudimos consultar el estado del sistema"
              message="El Gateway no respondió. Esto no invalida automáticamente tu sesión."
              onRetry={() => void health.refetch()}
            />
          ) : null}
          {health.data ? (
            <>
              <Badge
                tone={health.data.status === "ok" ? "success" : "warning"}
              >
                {health.data.status === "ok"
                  ? "Sistema operativo"
                  : "Sistema degradado"}
              </Badge>
              <div className="service-grid">
                {Object.entries(health.data.services).map(
                  ([name, service]) => (
                    <div className="service-status" key={name}>
                      <span
                        className={`status-dot status-dot--${service.status}`}
                        aria-hidden="true"
                      />
                      <div>
                        <strong>
                          {name === "users"
                            ? "Identidad"
                            : name === "autorepuesto"
                              ? "Operación ERP"
                              : "API Gateway"}
                        </strong>
                        <span>
                          {service.status === "ok"
                            ? "Disponible"
                            : "No disponible"}
                        </span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </>
          ) : null}
        </div>
      </details>
    </section>
  );
}
