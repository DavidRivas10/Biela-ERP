import { NavLink } from "react-router-dom";
import type { NavigationGroup } from "./navigation";

export function Sidebar({
  groups,
  open,
  onClose,
}: {
  groups: NavigationGroup[];
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <button
        className={`sidebar-overlay ${open ? "sidebar-overlay--open" : ""}`}
        type="button"
        aria-label="Cerrar navegación"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <aside
        className={`sidebar ${open ? "sidebar--open" : ""}`}
        aria-label="Navegación principal"
      >
        <div className="brand-lockup sidebar__brand">
          <span className="brand-mark">B</span>
          <span>BIELA</span>
        </div>
        <nav className="sidebar__nav">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => (
                <NavLink
                  className={({ isActive }) =>
                    `nav-link ${isActive ? "nav-link--active" : ""}`
                  }
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                >
                  <span className="nav-link__icon" aria-hidden="true">
                    {item.short}
                  </span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <p className="sidebar__phase">Módulos operativos · Fase 11</p>
      </aside>
    </>
  );
}
