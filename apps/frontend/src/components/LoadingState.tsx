import { BielaMark } from "./BielaMark";
import { EngineLoader } from "./EngineLoader";

export function LoadingState({ label = "Cargando" }: { label?: string }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="loading-state__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function FullPageLoading({
  label = "Validando sesión",
}: {
  label?: string;
}) {
  return (
    <main className="centered-page">
      <div className="brand-lockup brand-lockup--centered">
        <span className="brand-mark">
          <BielaMark />
        </span>
        <span>BIELA</span>
      </div>
      <EngineLoader label={label} />
    </main>
  );
}
