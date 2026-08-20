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
      <div className="brand-mark" aria-hidden="true">
        B
      </div>
      <LoadingState label={label} />
    </main>
  );
}
