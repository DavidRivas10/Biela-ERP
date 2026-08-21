import type { PaymentMethodKind, PaymentType } from "../types/purchasing";

const wholeNumber = new Intl.NumberFormat("es-HN", {
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("es-HN", {
  dateStyle: "medium",
  timeZone: "America/Tegucigalpa",
});

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
