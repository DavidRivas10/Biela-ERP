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
 *
 * By default a tab is a real navigation link. Pass `onSelect`/`onNew` (as the
 * Ventas workspace does) to make the tabs act in place instead — switching
 * which account is focused without a route change, so the other two columns
 * of the workspace never lose their own in-progress state.
 */
export function OpenAccountsBar({
  activeSaleId,
  onSelect,
  onNew,
}: {
  activeSaleId?: string;
  onSelect?: (saleId: string) => void;
  onNew?: () => void;
}) {
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
      {rows.map((sale) => {
        const isActive = sale.id === activeSaleId;
        const content = (
          <>
            <strong>{sale.accountLabel}</strong>
            <small>
              #{sale.number} · {sale._count?.items ?? 0} prod. ·{" "}
              {formatMoney(sale.total)}
            </small>
          </>
        );
        const className = `account-tabs__tab ${
          isActive ? "account-tabs__tab--active" : ""
        }`;
        return onSelect ? (
          <button
            key={sale.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={className}
            onClick={() => onSelect(sale.id)}
          >
            {content}
          </button>
        ) : (
          <Link
            key={sale.id}
            to={`/app/sales/${sale.id}/edit`}
            role="tab"
            aria-selected={isActive}
            className={className}
          >
            {content}
          </Link>
        );
      })}
      {onNew ? (
        <button
          type="button"
          role="tab"
          aria-selected={false}
          className="account-tabs__tab account-tabs__tab--new"
          onClick={onNew}
        >
          + Nueva cuenta
        </button>
      ) : (
        <Link
          to="/app/sales/new?mode=cuenta"
          role="tab"
          aria-selected={false}
          className="account-tabs__tab account-tabs__tab--new"
        >
          + Nueva cuenta
        </Link>
      )}
    </div>
  );
}
