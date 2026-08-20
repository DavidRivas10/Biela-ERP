import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { Sidebar } from "./Sidebar";
import { NAVIGATION, visibleNavigation } from "./navigation";

function routeTitle(pathname: string): string {
  return (
    NAVIGATION.flatMap((group) => group.items).find(
      (item) => item.path === pathname,
    )?.label ?? "BIELA"
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const groups = useMemo(() => visibleNavigation(user), [user]);
  const title = routeTitle(location.pathname);
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email;
  const roleNames =
    user?.roles.map((role) => role.name).join(", ") || "Sin rol";

  useEffect(() => {
    document.title = `${title} | BIELA`;
  }, [location.pathname, title]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <div className="app-layout">
      <Sidebar
        groups={groups}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
      <div className="app-main">
        <header className="topbar">
          <div className="topbar__leading">
            <button
              className="menu-button"
              type="button"
              aria-label="Abrir navegación"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            >
              <span />
              <span />
              <span />
            </button>
            <div>
              <p className="eyebrow">BIELA ERP</p>
              <strong>{title}</strong>
            </div>
          </div>
          <div className="user-menu">
            <div className="user-avatar" aria-hidden="true">
              {(user?.firstName?.[0] ?? user?.email[0] ?? "U").toUpperCase()}
            </div>
            <div className="user-menu__identity">
              <strong>{displayName}</strong>
              <span>{roleNames}</span>
            </div>
            <Button variant="ghost" onClick={logout}>
              Salir
            </Button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
