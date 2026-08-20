import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError, isApiUnavailable } from "../api/api-client";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { useAuth } from "../auth/AuthContext";

function safeDestination(value: unknown): string {
  return typeof value === "string" && value.startsWith("/app")
    ? value
    : "/app/dashboard";
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Iniciar sesión | BIELA";
  }, []);

  if (auth.status === "authenticated") {
    return <Navigate to="/app/dashboard" replace />;
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await auth.login(email.trim(), password);
      const from = (location.state as { from?: unknown } | null)?.from;
      void navigate(safeDestination(from), { replace: true });
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        setError("El correo o la contraseña no son válidos.");
      } else if (isApiUnavailable(requestError)) {
        setError(
          "El servicio de acceso no está disponible. Intenta nuevamente en unos momentos.",
        );
      } else {
        setError(
          "No pudimos iniciar la sesión. Revisa los datos e intenta nuevamente.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-intro" aria-label="Bienvenida a BIELA">
        <div className="login-intro__content">
          <div className="brand-lockup brand-lockup--light">
            <span className="brand-mark">B</span>
            <span>BIELA</span>
          </div>
          <p className="eyebrow eyebrow--light">
            Operación automotriz integrada
          </p>
          <h1>Control claro para cada movimiento del negocio.</h1>
          <p>
            Inventario, ventas, compras y caja conectados a una sola operación
            confiable.
          </p>
        </div>
      </section>

      <section className="login-form-panel">
        <form className="login-form" onSubmit={(event) => void submit(event)}>
          <div>
            <p className="eyebrow">Acceso seguro</p>
            <h2>Iniciar sesión</h2>
            <p className="muted">
              Usa las credenciales asignadas por tu administrador.
            </p>
          </div>

          {error ? <Alert title={error} /> : null}

          <label className="field">
            <span>Correo electrónico</span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <Button type="submit" loading={submitting} className="button--full">
            {submitting ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>
      </section>
    </main>
  );
}
