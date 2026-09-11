import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { salesApi } from "../api/sales-api";
import { useAuth } from "../auth/AuthContext";
import { queryKeys } from "../query/query-keys";
import { formatMoney } from "../utils/formatters";

const LIMIT = 12;

/**
 * Every open account (a DRAFT sale with a label — usually a vehicle in the
 * shop) as a row of tabs, so a vendor with several vehicles in progress can
 * jump between them without leaving the sale screen or going back to Punto
 * de venta. `activeSaleId` highlights the one currently open.
 */
export function OpenAccountsBar({ activeSaleId }: { activeSaleId?: string }) {
  const { hasPermission } = useAuth();
  const enabled = hasPermission("sales.read");
  const accounts = useQuery({
    queryKey: queryKeys.sales({ openAccountsBar: true, page: 1, limit: LIMIT }),
    queryFn: () =>
      salesApi.list({
        status: "DRAFT",
        hasAccountLabel: true,
        page: 1,
        limit: LIMIT,
      }),
    enabled,
  });
  if (!enabled) return null;
  const rows = accounts.data?.data ?? [];
  if (accounts.isPending || (rows.length === 0 && !activeSaleId)) return null;

  return (
    <div
      className="account-tabs"
      role="tablist"
      aria-label="Cuentas abiertas"
    >
      {rows.map((sale) => (
        <Link
          key={sale.id}
          to={`/app/sales/${sale.id}/edit`}
          role="tab"
          aria-selected={sale.id === activeSaleId}
          className={`account-tabs__tab ${
            sale.id === activeSaleId ? "account-tabs__tab--active" : ""
          }`}
        >
          <strong>{sale.accountLabel}</strong>
          <small>
            #{sale.number} · {sale._count?.items ?? 0} prod. ·{" "}
            {formatMoney(sale.total)}
          </small>
        </Link>
      ))}
      <Link
        to="/app/sales/new?mode=cuenta"
        role="tab"
        aria-selected={false}
        className="account-tabs__tab account-tabs__tab--new"
      >
        + Nueva cuenta
      </Link>
    </div>
  );
}
