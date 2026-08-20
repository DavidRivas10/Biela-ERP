import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("BIELA frontend boundary", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="centered-page">
        <section className="error-panel">
          <p className="eyebrow">Error de aplicación</p>
          <h1>No pudimos mostrar esta pantalla</h1>
          <p>
            Recarga la aplicación. Si el problema continúa, comunícalo al equipo
            técnico.
          </p>
          <Button onClick={() => window.location.reload()}>
            Recargar aplicación
          </Button>
        </section>
      </main>
    );
  }
}
