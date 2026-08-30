import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

interface Tab {
  label: string;
  to: string;
  end?: boolean;
  permission?: string;
}

const TABS: Tab[] = [
  { label: "Sesiones", to: "/app/cash/sessions", end: true },
  {
    label: "Movimientos",
    to: "/app/cash/movements",
    permission: "cash-movements.read",
  },
];

/**
 * Sub-navigation for the cash operation. Aperturas/cierres and the movement
 * ledger are one screen with tabs instead of two separate sidebar entries.
 */
export function CashTabs() {
  const { hasPermission } = useAuth();
  const visible = TABS.filter(
    (tab) => !tab.permission || hasPermission(tab.permission),
  );
  if (visible.length < 2) return null;
  return (
    <nav className="subtabs" aria-label="Secciones de caja">
      {visible.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `subtabs__tab ${isActive ? "subtabs__tab--active" : ""}`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
