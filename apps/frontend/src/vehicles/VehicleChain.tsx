import { Link } from "react-router-dom";

/**
 * The fixed order in which vehicle data is built. Shown as a row of links (not a
 * paragraph) so the chain Marca → Modelo → Vehículo → Compatibilidad is obvious
 * from the screen itself and each step is one click away.
 */
const STEPS = [
  {
    key: "brand",
    label: "Marca",
    hint: "Toyota, Nissan…",
    to: "/app/mantenimientos/marcas-vehiculo",
  },
  {
    key: "model",
    label: "Modelo",
    hint: "Hilux, Sentra…",
    to: "/app/mantenimientos/modelos",
  },
  {
    key: "vehicle",
    label: "Vehículo",
    hint: "modelo + año + motor",
    to: "/app/vehicles",
  },
  {
    key: "compat",
    label: "Compatibilidad",
    hint: "qué repuesto le queda",
    to: "/app/compatibility",
  },
] as const;

export type VehicleChainStep = (typeof STEPS)[number]["key"];

export function VehicleChain({ current }: { current?: VehicleChainStep }) {
  return (
    <nav className="chain-nav" aria-label="Cómo se arma un vehículo">
      {STEPS.map((step, index) => (
        <span className="chain-nav__item" key={step.key}>
          <Link
            className={`chain-nav__step${
              current === step.key ? " chain-nav__step--current" : ""
            }`}
            to={step.to}
            aria-current={current === step.key ? "step" : undefined}
          >
            <strong>{step.label}</strong>
            <small>{step.hint}</small>
          </Link>
          {index < STEPS.length - 1 ? (
            <span className="chain-nav__arrow" aria-hidden="true">
              ›
            </span>
          ) : null}
        </span>
      ))}
    </nav>
  );
}
