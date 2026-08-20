import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Button } from "../components/Button";
import { FullPageLoading } from "../components/LoadingState";
import { useAuth } from "./AuthContext";

export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === "loading") return <FullPageLoading />;

  if (auth.status === "unavailable") {
    return (
      <main className="centered-page">
        <section className="error-panel">
          <p className="eyebrow">Sesión pendiente</p>
          <h1>No podemos validar tu acceso</h1>
          <p>{auth.restoreError}</p>
          <div className="button-row">
            <Button onClick={auth.retryRestore}>Reintentar</Button>
            <Button variant="secondary" onClick={auth.logout}>
              Cerrar sesión
            </Button>
          </div>
        </section>
      </main>
    );
  }

  if (auth.status !== "authenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
