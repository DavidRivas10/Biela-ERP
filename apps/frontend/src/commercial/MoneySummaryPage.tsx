import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { getMoneySummary } from "../api/commercial-api";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { Field } from "../components/Field";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { TabBar, TabPanel, type WorkspaceTabItem } from "../components/WorkspaceTabs";
import { useUrlFilters } from "../hooks/use-url-filters";
import { queryKeys } from "../query/query-keys";
import type { MoneySummary, MoneySummaryMethodAmount } from "../types/api";
import { apiErrorMessage } from "../utils/api-error";
import {
  formatCalendarDate,
  formatDateTime,
  formatMoney,
} from "../utils/formatters";

type MoneyTabKey = "same-day" | "receivables" | "purchases" | "cash-sessions";

const MONEY_TABS: WorkspaceTabItem<MoneyTabKey>[] = [
  { key: "same-day", label: "Vendido y cobrado el mismo día" },
  { key: "receivables", label: "Cobrado de cuentas por cobrar" },
  { key: "purchases", label: "Pagado a proveedores" },
  { key: "cash-sessions", label: "Efectivo esperado por caja abierta" },
];

/** The big-total-plus-breakdown display, reusing the same "totals bar"
 * pattern Ventas already uses for its own big, unmissable total. */
function MoneyBreakdown({
  total,
  byMethod,
}: {
  total: string;
  byMethod: MoneySummaryMethodAmount[];
}) {
  return (
    <>
      <div className="sale-totals-bar">
        <div className="sale-totals-bar__total">
          <span className="sale-totals-bar__label">Total</span>
          <span className="sale-totals-bar__amount">{formatMoney(total)}</span>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Método de pago</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            {byMethod.map((row) => (
              <tr key={row.paymentMethodId}>
                <td>{row.name}</td>
                <td>{formatMoney(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * One of the three date-scoped Dinero tabs: its own Desde/Hasta, kept in
 * the URL under a tab-specific prefix so the three tabs' filters never
 * collide and each survives switching away and back — the same reasoning
 * Ventas already applies to its three independent drafts.
 */
function MoneyDateRangeTab({
  idPrefix,
  paramPrefix,
  title,
  hint,
  select,
}: {
  idPrefix: string;
  paramPrefix: string;
  title: string;
  hint: string;
  select: (data: MoneySummary) => { total: string; byMethod: MoneySummaryMethodAmount[] };
}) {
  const filters = useUrlFilters();
  const fromKey = `${paramPrefix}From`;
  const toKey = `${paramPrefix}To`;
  const dateFrom = filters.values[fromKey];
  const dateTo = filters.values[toKey];
  const params = { dateFrom, dateTo };
  const summary = useQuery({
    queryKey: queryKeys.moneySummary(params),
    queryFn: () => getMoneySummary(params),
  });
  const hasActiveFilters = Boolean(dateFrom || dateTo);

  return (
    <section className="panel">
      <h2>{title}</h2>
      <p className="muted">{hint}</p>
      <div className="filter-bar">
        <Field label="Desde" htmlFor={`${idPrefix}-from`}>
          <input
            id={`${idPrefix}-from`}
            type="date"
            value={dateFrom ?? ""}
            onChange={(e) => filters.update({ [fromKey]: e.target.value })}
          />
        </Field>
        <Field label="Hasta" htmlFor={`${idPrefix}-to`}>
          <input
            id={`${idPrefix}-to`}
            type="date"
            value={dateTo ?? ""}
            onChange={(e) => filters.update({ [toKey]: e.target.value })}
          />
        </Field>
        {hasActiveFilters ? (
          <div className="filter-actions">
            <Button
              variant="ghost"
              onClick={() =>
                filters.update({ [fromKey]: undefined, [toKey]: undefined })
              }
            >
              Volver a hoy
            </Button>
          </div>
        ) : null}
      </div>
      {summary.isPending ? (
        <LoadingState label="Consultando este total" />
      ) : null}
      {summary.isError ? (
        <ErrorState
          title="No se pudo cargar este total"
          message={apiErrorMessage(summary.error)}
          onRetry={() => void summary.refetch()}
        />
      ) : null}
      {summary.data ? (
        <>
          <p className="data-note">
            Rango mostrado: {formatCalendarDate(summary.data.dateFrom)} al{" "}
            {formatCalendarDate(summary.data.dateTo)}. Son montos operativos
            calculados a partir de los pagos ya registrados — no es
            contabilidad, utilidad ni un estado financiero.
          </p>
          <MoneyBreakdown {...select(summary.data)} />
        </>
      ) : null}
    </section>
  );
}

/** The fourth tab: current state, not scoped to any date range. */
function OpenCashSessionsTab() {
  const summary = useQuery({
    queryKey: queryKeys.moneySummary({}),
    queryFn: () => getMoneySummary({}),
  });

  return (
    <section className="panel">
      <h2>Efectivo esperado por caja abierta</h2>
      <p className="muted">
        Estado actual — no depende de ningún rango de fechas.
      </p>
      {summary.isPending ? (
        <LoadingState label="Consultando las cajas abiertas" />
      ) : null}
      {summary.isError ? (
        <ErrorState
          title="No se pudieron cargar las cajas abiertas"
          message={apiErrorMessage(summary.error)}
          onRetry={() => void summary.refetch()}
        />
      ) : null}
      {summary.data ? (
        summary.data.openCashSessions.length === 0 ? (
          <EmptyState title="No hay sesiones de caja abiertas ahora">
            Cuando alguien abra una caja, va a aparecer acá con su efectivo
            esperado en vivo.
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
        )
      ) : null}
    </section>
  );
}

export function MoneySummaryPage() {
  const [activeTab, setActiveTab] = useState<MoneyTabKey>("same-day");

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Dinero"
        title="Resumen"
        description="Cuánto entró y salió, y de dónde — una pestaña por sección."
      />
      <TabBar
        idPrefix="money-summary"
        ariaLabel="Resumen de dinero"
        tabs={MONEY_TABS}
        activeKey={activeTab}
        onChange={setActiveTab}
      />
      <div className="workspace-tab-content">
        <TabPanel idPrefix="money-summary" tabKey="same-day" activeKey={activeTab}>
          <MoneyDateRangeTab
            idPrefix="money-same-day"
            paramPrefix="sameDay"
            title="Vendido y cobrado el mismo día"
            hint="Ventas del período, cobradas ese mismo día — por ejemplo, todo lo que pasa por Venta rápida."
            select={(data) => data.salesCollected}
          />
        </TabPanel>
        <TabPanel idPrefix="money-summary" tabKey="receivables" activeKey={activeTab}>
          <MoneyDateRangeTab
            idPrefix="money-receivables"
            paramPrefix="receivables"
            title="Cobrado de cuentas por cobrar"
            hint="Abonos y pagos recibidos en el período por ventas hechas en un día anterior."
            select={(data) => data.receivablesCollected}
          />
        </TabPanel>
        <TabPanel idPrefix="money-summary" tabKey="purchases" activeKey={activeTab}>
          <MoneyDateRangeTab
            idPrefix="money-purchases"
            paramPrefix="purchases"
            title="Pagado a proveedores"
            hint="Pagos a proveedores registrados en el período."
            select={(data) => data.purchasesPaid}
          />
        </TabPanel>
        <TabPanel idPrefix="money-summary" tabKey="cash-sessions" activeKey={activeTab}>
          <OpenCashSessionsTab />
        </TabPanel>
      </div>
    </div>
  );
}
