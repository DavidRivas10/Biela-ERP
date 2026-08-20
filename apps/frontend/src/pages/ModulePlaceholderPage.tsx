import { EmptyState } from "../components/EmptyState";

export function ModulePlaceholderPage({ title }: { title: string }) {
  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Espacio de trabajo</p>
          <h1>{title}</h1>
        </div>
      </div>
      <EmptyState title="Módulo preparado para una fase posterior">
        La navegación y el control de acceso ya están activos. Los flujos
        operativos de {title.toLowerCase()} todavía no forman parte de esta
        fase.
      </EmptyState>
    </section>
  );
}
