import type { PaymentMethodKind, PaymentType } from "../types/purchasing";

const wholeNumber = new Intl.NumberFormat("es-HN", {
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("es-HN", {
  dateStyle: "medium",
  timeZone: "America/Tegucigalpa",
});
const businessDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Tegucigalpa",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Today as YYYY-MM-DD in Honduras's own calendar day — never the browser's
 * UTC day. `new Date().toISOString().slice(0, 10)` reads the UTC date
 * instead, which is 6 hours ahead of Honduras: from 6pm to midnight local
 * time it silently returns tomorrow's date. Mirrors the backend's own
 * businessDate() (CommercialService), so "today" means the same day on
 * both sides.
 */
export function getBusinessDate(): string {
  const parts = businessDateFormatter.formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const paymentMethodKindLabels: Record<PaymentMethodKind, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  BANK_TRANSFER: "Transferencia bancaria",
  OTHER: "Otro",
};

const paymentTypeLabels: Record<PaymentType, string> = {
  PURCHASE_PAYMENT: "Pago de compra",
  SUPPLIER_REFUND: "Reembolso de proveedor",
  SALE_PAYMENT: "Cobro de venta",
  SALE_REFUND: "Reembolso a cliente",
};

export function formatPaymentMethodKind(value: PaymentMethodKind): string {
  return paymentMethodKindLabels[value];
}

export function formatPaymentType(value: PaymentType): string {
  return paymentTypeLabels[value];
}

export function pluralize(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * "Pasillo de filtros · Estante 2 · Nivel 3" from a Location's physical
 * fields — wherever a location is shown, so finding the part on the shelf
 * doesn't need a separate lookup. `null` when none of it was filled in.
 */
export function locationPhysicalHint(location: {
  aisle?: string | null;
  shelf?: string | null;
  bin?: string | null;
}): string | null {
  const parts = [location.aisle, location.shelf, location.bin].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function formatMoney(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return value;
  const [, sign, whole, decimal = ""] = match;
  const fraction = decimal.padEnd(2, "0").slice(0, 2);
  return `${sign}L ${wholeNumber.format(BigInt(whole))}.${fraction}`;
}

export function isPositiveMoneyAtMost(
  value: string,
  maximum?: string,
): boolean {
  const amount = moneyMinorUnits(value);
  const limit = maximum ? moneyMinorUnits(maximum) : null;
  return (
    amount !== null &&
    amount > 0n &&
    (maximum === undefined || (limit !== null && amount <= limit))
  );
}

export function isMoneyAtLeast(value: string, minimum: string): boolean {
  const amount = moneyMinorUnits(value);
  const floor = moneyMinorUnits(minimum);
  return amount !== null && floor !== null && amount >= floor;
}

function moneyMinorUnits(value: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
}

export function formatBusinessDate(value: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00-06:00`)
    : new Date(value);
  return Number.isNaN(date.valueOf()) ? value : dateFormatter.format(date);
}

export function formatCalendarDate(value: string): string {
  return formatBusinessDate(value.slice(0, 10));
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("es-HN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Tegucigalpa",
  }).format(date);
}
