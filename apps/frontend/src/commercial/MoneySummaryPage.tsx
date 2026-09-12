import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getMoneySummary } from "../api/commercial-api";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { Field } from "../components/Field";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { useUrlFilters } from "../hooks/use-url-filters";
import { queryKeys } from "../query/query-keys";
import type { MoneySummaryMethodAmount } from "../types/api";
import { apiErrorMessage } from "../utils/api-error";
import {
  formatCalendarDate,
  formatDateTime,
  formatMoney,
} from "../utils/formatters";

function MethodBreakdown({
  title,
  hint,
  total,
  byMethod,
}: {
  title: string;
  hint: string;
  total: string;
  byMethod: MoneySummaryMethodAmount[];
}) {
  return (
    <section className="panel money-summary-card">
      <div className="money-summary-card__head">
        <h2>{title}</h2>
        <strong className="money-summary-card__total">
          {formatMoney(total)}
        </strong>
      </div>
      <p className="muted">{hint}</p>
      <ul className="money-summary-card__methods">
        {byMethod.map((row) => (
          <li key={row.paymentMethodId}>
            <span>{row.name}</span>
            <strong>{formatMoney(row.amount)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MoneySummaryPage() {
  const filters = useUrlFilters();
  const params = {
    dateFrom: filters.values.dateFrom,
    dateTo: filters.values.dateTo,
  };
  const summary = useQuery({
    queryKey: queryKeys.moneySummary(params),
    queryFn: () => getMoneySummary(params),
  });
  const hasActiveFilters = Boolean(
    filters.values.dateFrom || filters.values.dateTo,
  );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Dinero"
        title="Resumen"
        description="Cuánto entró y salió, y de dónde — para el rango de fechas elegido."
      />

      <section className="panel">
        <div className="filter-bar">
          <Field label="Desde" htmlFor="money-summary-from">
            <input
              id="money-summary-from"
              type="date"
              value={filters.values.dateFrom ?? ""}
              onChange={(e) => filters.update({ dateFrom: e.target.value })}
            />
          </Field>
          <Field label="Hasta" htmlFor="money-summary-to">
            <input
              id="money-summary-to"
              type="date"
              value={filters.values.dateTo ?? ""}
              onChange={(e) => filters.update({ dateTo: e.target.value })}
            />
          </Field>
          {hasActiveFilters ? (
            <div className="filter-actions">
              <Button variant="ghost" onClick={filters.clear}>
                Volver a hoy
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {summary.isPending ? (
        <LoadingState label="Consultando el resumen de dinero" />
      ) : null}
      {summary.isError ? (
        <ErrorState
          title="No se pudo cargar el resumen de dinero"
          message={apiErrorMessage(summary.error)}
          onRetry={() => void summary.refetch()}
        />
      ) : null}
      {summary.data ? (
        <>
          <p className="data-note">
            Rango mostrado: {formatCalendarDate(summary.data.dateFrom)} al{" "}
            {formatCalendarDate(summary.data.dateTo)}. Son montos operativos
            calculados a partir de los pagos y sesiones de caja ya
            registrados — no es contabilidad, utilidad ni un estado
            financiero.
          </p>
          <div className="money-summary-grid">
            <MethodBreakdown
              title="Vendido y cobrado el mismo día"
              hint="Ventas del período, cobradas ese mismo día — por ejemplo, todo lo que pasa por Venta rápida."
              total={summary.data.salesCollected.total}
              byMethod={summary.data.salesCollected.byMethod}
            />
            <MethodBreakdown
              title="Cobrado de cuentas por cobrar"
              hint="Abonos y pagos recibidos en el período por ventas hechas en un día anterior."
              total={summary.data.receivablesCollected.total}
              byMethod={summary.data.receivablesCollected.byMethod}
            />
            <MethodBreakdown
              title="Pagado a proveedores"
              hint="Pagos a proveedores registrados en el período."
              total={summary.data.purchasesPaid.total}
              byMethod={summary.data.purchasesPaid.byMethod}
            />
          </div>

          <section className="panel">
            <h2>Efectivo esperado por sesión de caja abierta</h2>
            <p className="muted">
              Estado actual, no depende del rango de fechas elegido arriba.
            </p>
            {summary.data.openCashSessions.length === 0 ? (
              <EmptyState title="No hay sesiones de caja abiertas ahora">
                Cuando alguien abra una caja, va a aparecer acá con su
                efectivo esperado en vivo.
              </EmptyState>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Caja</th>
                      <th>Abierta desde</th>
                      <th>Monto de apertura</th>
                      <th>Efectivo esperado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.data.openCashSessions.map((session) => (
                      <tr key={session.id}>
                        <td>
                          <Link
                            className="table-link"
                            to={`/app/cash/sessions/${session.id}`}
                          >
                            <strong>{session.cashRegisterCode}</strong>
                            <small>{session.cashRegisterName}</small>
                          </Link>
                        </td>
                        <td>{formatDateTime(session.openedAt)}</td>
                        <td>{formatMoney(session.openingAmount)}</td>
                        <td>{formatMoney(session.expectedCash)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
