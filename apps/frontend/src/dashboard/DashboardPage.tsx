import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getCommercialSummary } from "../api/commercial-api";
import { getSystemHealth } from "../api/system-api";
import { useAuth } from "../auth/AuthContext";
import { hasPermission } from "../auth/permissions";
import { Alert } from "../components/Alert";
import { Badge } from "../components/Badge";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { visibleNavigation } from "../layout/navigation";
import { formatBusinessDate, formatMoney } from "../utils/formatters";

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
    queryKey: ["commercial-summary"],
    queryFn: getCommercialSummary,
    enabled: canReadSummary,
    retry: false,
  });

  return (
    <section className="page-section dashboard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Vista operativa</p>
          <h1>Buenos días, {user?.firstName || "equipo"}</h1>
          <p>
            Estado actual del sistema y de la operación comercial autorizada.
          </p>
        </div>
      </div>

      <section className="system-card" aria-labelledby="system-status-title">
        <div>
          <p className="eyebrow">Servicios</p>
          <h2 id="system-status-title">Estado de la plataforma</h2>
        </div>
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
            <Badge tone={health.data.status === "ok" ? "success" : "warning"}>
              {health.data.status === "ok"
                ? "Sistema operativo"
                : "Sistema degradado"}
            </Badge>
            <div className="service-grid">
              {Object.entries(health.data.services).map(([name, service]) => (
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
                      {service.status === "ok" ? "Disponible" : "No disponible"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>

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
                  <small>Espacio del módulo</small>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {canReadSummary ? (
        <section aria-labelledby="commercial-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Resumen comercial real</p>
              <h2 id="commercial-title">Posición operativa</h2>
            </div>
            {summary.data ? (
              <span>
                Fecha de negocio:{" "}
                {formatBusinessDate(summary.data.businessDate)}
              </span>
            ) : null}
          </div>
          {summary.isPending ? (
            <LoadingState label="Consultando resumen comercial" />
          ) : null}
          {summary.isError ? (
            <ErrorState
              title="El resumen comercial no está disponible"
              message="Los demás módulos siguen accesibles según tus permisos."
              onRetry={() => void summary.refetch()}
            />
          ) : null}
          {summary.data ? (
            <div className="metrics-grid">
              <Metric
                label="Cuentas por cobrar"
                value={formatMoney(summary.data.receivables.outstandingAmount)}
                detail={`${summary.data.receivables.documentCount} documentos · ${summary.data.receivables.overdueCount} vencidos`}
              />
              <Metric
                label="Cuentas por pagar"
                value={formatMoney(summary.data.payables.outstandingAmount)}
                detail={`${summary.data.payables.documentCount} documentos · ${summary.data.payables.overdueCount} vencidos`}
              />
              <Metric
                label="Efectivo esperado"
                value={formatMoney(summary.data.cash.expectedCash)}
                detail={`${summary.data.cash.openSessionCount} sesiones de caja abiertas`}
              />
              <Metric
                label="Monto vencido"
                value={formatMoney(summary.data.receivables.overdueAmount)}
                detail="Cuentas por cobrar vencidas"
              />
            </div>
          ) : null}
          <p className="data-note">
            Valores operativos derivados por el backend; no representan
            utilidad, COGS ni estados contables.
          </p>
        </section>
      ) : (
        <Alert tone="info" title="Resumen comercial restringido">
          Tu rol no incluye <code>commercial-summary.read</code>. No se realizó
          ninguna solicitud a ese endpoint.
        </Alert>
      )}
    </section>
  );
}
