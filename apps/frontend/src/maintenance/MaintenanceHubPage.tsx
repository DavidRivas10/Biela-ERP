import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";

interface MaintenanceEntry {
  short: string;
  label: string;
  /** What real form this list feeds — in the operator's words. */
  feeds: string;
  path: string;
  permission: string;
}

interface MaintenanceSection {
  title: string;
  entries: MaintenanceEntry[];
}

const SECTIONS: MaintenanceSection[] = [
  {
    title: "Productos",
    entries: [
      {
        short: "CT",
        label: "Categorías de producto",
        feeds:
          "Los grupos con los que ordenas el catálogo: Filtros, Frenos, Lubricantes. Se eligen al crear un producto y agrupan sus atributos.",
        path: "/app/mantenimientos/categorias",
        permission: "products.read",
      },
      {
        short: "MP",
        label: "Marcas de producto",
        feeds:
          "El fabricante de la pieza: Bosch, NGK, Monroe. Se elige al crear un producto. No son marcas de carro.",
        path: "/app/mantenimientos/marcas-producto",
        permission: "products.read",
      },
      {
        short: "AT",
        label: "Atributos de producto",
        feeds:
          "Las características técnicas de cada categoría: diámetro, rosca, viscosidad. Aparecen como campos al crear un producto de esa categoría.",
        path: "/app/mantenimientos/atributos",
        permission: "products.read",
      },
    ],
  },
  {
    title: "Vehículos",
    entries: [
      {
        short: "MV",
        label: "Marcas de vehículo",
        feeds:
          "Las marcas de carro: Toyota, Nissan, Hyundai. Son la base para armar los modelos y la compatibilidad de las piezas.",
        path: "/app/mantenimientos/marcas-vehiculo",
        permission: "vehicles.read",
      },
      {
        short: "MD",
        label: "Modelos de vehículo",
        feeds:
          "El modelo concreto de cada marca con sus años: Hilux, Sentra, Accent. Se usa al registrar un vehículo y al definir qué piezas le sirven.",
        path: "/app/mantenimientos/modelos",
        permission: "vehicles.read",
      },
    ],
  },
  {
    title: "Almacén",
    entries: [
      {
        short: "UB",
        label: "Ubicaciones",
        feeds:
          "El lugar físico del taller donde guardas una pieza: pasillo, estante, nivel. Se asigna en el inventario para poder encontrarla rápido.",
        path: "/app/mantenimientos/ubicaciones",
        permission: "locations.read",
      },
    ],
  },
];

export function MaintenanceHubPage() {
  const { hasPermission } = useAuth();
  const sections = SECTIONS.map((section) => ({
    ...section,
    entries: section.entries.filter((entry) =>
      hasPermission(entry.permission),
    ),
  })).filter((section) => section.entries.length > 0);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Mantenimientos"
        title="Listas base del sistema"
        description="Aquí creas, editas y desactivas las listas que llenan los formularios del resto del sistema. No se usan para operar el día a día: solo para prepararlo."
      />

      {sections.length === 0 ? (
        <EmptyState title="No tienes acceso a ningún mantenimiento">
          Tu usuario no incluye permisos de catálogo de productos, vehículos ni
          ubicaciones. Pídele a un administrador que te los asigne si necesitas
          preparar estas listas.
        </EmptyState>
      ) : (
        sections.map((section) => (
          <section className="panel maint-section" key={section.title}>
            <h2>{section.title}</h2>
            <div className="maint-grid">
              {section.entries.map((entry) => (
                <Link
                  className="maint-card"
                  to={entry.path}
                  key={entry.path}
                >
                  <span className="maint-card__chip" aria-hidden="true">
                    {entry.short}
                  </span>
                  <span className="maint-card__body">
                    <strong>{entry.label}</strong>
                    <small>{entry.feeds}</small>
                  </span>
                  <span className="maint-card__go" aria-hidden="true">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
