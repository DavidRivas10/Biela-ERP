import type {
  PaymentStatus,
  PurchaseStatus,
  PurchasingDocumentStatus,
  SettlementStatus,
} from "../types/purchasing";
import { Badge } from "./Badge";

const labels: Record<string, string> = {
  DRAFT: "Borrador",
  CONFIRMED: "Confirmada",
  PARTIALLY_RECEIVED: "Recibida parcialmente",
  RECEIVED: "Recibida",
  CANCELLED: "Cancelada",
  POSTED: "Registrado",
  REVERSED: "Reversado",
  UNPAID: "Pendiente",
  PARTIALLY_PAID: "Pago parcial",
  PAID: "Pagada",
};

export function CommercialStatusBadge({
  status,
}: {
  status:
    | PurchaseStatus
    | PurchasingDocumentStatus
    | SettlementStatus
    | PaymentStatus;
}) {
  const tone =
    status === "PAID" || status === "POSTED" || status === "RECEIVED"
      ? "success"
      : status === "CANCELLED" || status === "REVERSED"
        ? "danger"
        : status === "DRAFT"
          ? "neutral"
          : "warning";
  return <Badge tone={tone}>{labels[status] ?? status}</Badge>;
}
