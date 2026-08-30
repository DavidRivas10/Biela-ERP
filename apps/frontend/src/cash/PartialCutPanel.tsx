import { Button } from "../components/Button";
import type { CashSessionSummary } from "../types/cash";
import { formatDateTime, formatMoney } from "../utils/formatters";

/**
 * Read-only "partial cut" of an OPEN cash session: a snapshot of where the
 * drawer stands right now, so an administrator can review mid-shift progress
 * without closing the session or moving any cash. Nothing here mutates.
 */
export function PartialCutPanel({ summary }: { summary: CashSessionSummary }) {
  const totals = summary.movementTotals;
  const amount = (value: string | undefined) => formatMoney(value ?? "0");
  const rows: Array<{ label: string; value: string; strong?: boolean }> = [
    { label: "Efectivo inicial", value: formatMoney(summary.openingAmount) },
    { label: "Cobros de venta en efectivo", value: amount(totals.SALE_PAYMENT) },
    { label: "Reembolsos a clientes", value: amount(totals.SALE_REFUND) },
    { label: "Pagos a proveedores en efectivo", value: amount(totals.PURCHASE_PAYMENT) },
    { label: "Reembolsos de proveedores", value: amount(totals.SUPPLIER_REFUND) },
    { label: "Entradas manuales", value: amount(totals.MANUAL_IN) },
    { label: "Salidas manuales", value: amount(totals.MANUAL_OUT) },
    {
      label: "Efectivo esperado en caja ahora",
      value: formatMoney(summary.expectedCash),
      strong: true,
    },
  ];

  return (
    <section className="panel cut-panel">
      <div className="section-heading">
        <div>
          <h2>Corte parcial (informativo)</h2>
          <p>
            Foto del estado de la caja, generada el{" "}
            {formatDateTime(new Date().toISOString())}. No cierra la sesión ni
            retira efectivo.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => window.print()}
        >
          Imprimir corte
        </Button>
      </div>
      <dl className="cut-panel__rows">
        {rows.map((row) => (
          <div key={row.label} className={row.strong ? "cut-panel__row--strong" : ""}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {summary.paymentTotalsByMethod.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Forma de pago</th>
                <th>Cobros</th>
                <th>Reembolsos</th>
              </tr>
            </thead>
            <tbody>
              {summary.paymentTotalsByMethod.map((method) => (
                <tr key={method.paymentMethod.id}>
                  <td>
                    {method.paymentMethod.code} · {method.paymentMethod.name}
                  </td>
                  <td>{formatMoney(method.payments)}</td>
                  <td>{formatMoney(method.refunds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
