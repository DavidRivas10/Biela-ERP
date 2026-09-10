import { Link } from "react-router-dom";
import type { PurchaseStatus } from "../types/purchasing";

/**
 * The fixed order a purchase goes through, shown as a row of steps (not a
 * paragraph) so "¿es la factura o son los productos?" is answered by the screen
 * itself: you register the invoice, confirm it, receive the goods, then pay.
 */
const STEPS = [
  {
    key: "register",
    label: "1. Registrar la factura",
    hint: "número, fecha y productos que trae",
  },
  { key: "confirm", label: "2. Confirmar", hint: "revisás y confirmás" },
  {
    key: "receive",
    label: "3. Recibir la mercadería",
    hint: "qué llegó y a qué ubicación → sube el inventario",
  },
  { key: "pay", label: "4. Pagar", hint: "registrás el pago al proveedor" },
] as const;

export type PurchaseChainStep = (typeof STEPS)[number]["key"];

export function purchaseStep(status: PurchaseStatus): PurchaseChainStep | null {
  switch (status) {
    case "DRAFT":
      return "confirm";
    case "CONFIRMED":
    case "PARTIALLY_RECEIVED":
      return "receive";
    case "RECEIVED":
      return "pay";
    default:
      return null;
  }
}

export function PurchaseChain({
  current,
  purchaseId,
}: {
  current?: PurchaseChainStep;
  purchaseId?: string;
}) {
  return (
    <nav className="chain-nav" aria-label="Cómo avanza una compra">
      {STEPS.map((step, index) => {
        const inner = (
          <>
            <strong>{step.label}</strong>
            <small>{step.hint}</small>
          </>
        );
        const isCurrent = current === step.key;
        const className = `chain-nav__step${
          isCurrent ? " chain-nav__step--current" : ""
        }`;
        return (
          <span className="chain-nav__item" key={step.key}>
            {purchaseId && step.key === "register" ? (
              <Link
                className={className}
                to={`/app/purchasing/purchases/${purchaseId}/edit`}
              >
                {inner}
              </Link>
            ) : (
              <span
                className={className}
                aria-current={isCurrent ? "step" : undefined}
              >
                {inner}
              </span>
            )}
            {index < STEPS.length - 1 ? (
              <span className="chain-nav__arrow" aria-hidden="true">
                ›
              </span>
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}
