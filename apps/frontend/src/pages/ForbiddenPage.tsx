import { Link } from "react-router-dom";

export function ForbiddenPage() {
  return (
    <main className="centered-page">
      <section className="error-panel">
        <p className="error-code">403</p>
        <h1>No tienes permiso para ver esta sección</h1>
        <p>Tu sesión es válida, pero tu rol no incluye el acceso solicitado.</p>
        <Link className="button button--primary" to="/app/dashboard">
          Volver al panel
        </Link>
      </section>
    </main>
  );
}
