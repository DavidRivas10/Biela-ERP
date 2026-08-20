import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function NotFoundPage() {
  const { isAuthenticated } = useAuth();
  return (
    <main className="centered-page">
      <section className="error-panel">
        <p className="error-code">404</p>
        <h1>Esta página no existe</h1>
        <p>La dirección puede haber cambiado o no pertenece a BIELA.</p>
        <Link
          className="button button--primary"
          to={isAuthenticated ? "/app/dashboard" : "/login"}
        >
          {isAuthenticated ? "Ir al panel" : "Ir a iniciar sesión"}
        </Link>
      </section>
    </main>
  );
}
