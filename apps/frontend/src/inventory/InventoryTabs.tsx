import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

interface Tab {
  label: string;
  to: string;
  end?: boolean;
  permission?: string;
}

const TABS: Tab[] = [
  { label: "Existencias", to: "/app/inventory", end: true },
  { label: "Movimientos", to: "/app/inventory/movements" },
  {
    label: "Transferencias",
    to: "/app/inventory/transfers",
    permission: "inventory.transfer",
  },
  { label: "Buscar repuesto", to: "/app/search", permission: "search.read" },
];

/**
 * Sub-navigation for the warehouse hub. Existencias, Movimientos, Transferencias
 * and the deterministic product/vehicle search are one screen with tabs instead
 * of four separate sidebar entries.
 */
export function InventoryTabs() {
  const { hasPermission } = useAuth();
  const visible = TABS.filter(
    (tab) => !tab.permission || hasPermission(tab.permission),
  );
  return (
    <nav className="subtabs" aria-label="Secciones de almacén">
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
