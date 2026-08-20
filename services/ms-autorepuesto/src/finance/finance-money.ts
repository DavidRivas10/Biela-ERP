import { BadRequestException } from "@nestjs/common";
import { CashMovementType, Prisma } from "@prisma/client";

export const ZERO = new Prisma.Decimal(0);

export function money(value: string | Prisma.Decimal, field = "amount") {
  let result: Prisma.Decimal;
  try {
    result = new Prisma.Decimal(value);
  } catch {
    throw new BadRequestException(`${field} must be a valid monetary amount`);
  }
  if (!result.isFinite() || result.decimalPlaces() > 2)
    throw new BadRequestException(`${field} must have at most two decimals`);
  if (result.isNegative())
    throw new BadRequestException(`${field} cannot be negative`);
  return result.toDecimalPlaces(2);
}

export function positiveMoney(
  value: string | Prisma.Decimal,
  field = "amount",
) {
  const result = money(value, field);
  if (!result.greaterThan(0))
    throw new BadRequestException(`${field} must be greater than zero`);
  return result;
}

export function movementDelta(type: CashMovementType, amount: Prisma.Decimal) {
  return type === CashMovementType.SALE_PAYMENT ||
    type === CashMovementType.SALE_REFUND_REVERSAL ||
    type === CashMovementType.PURCHASE_PAYMENT_REVERSAL ||
    type === CashMovementType.SUPPLIER_REFUND ||
    type === CashMovementType.MANUAL_IN
    ? amount
    : amount.negated();
}

export function settlementStatus(
  paidAmount: Prisma.Decimal,
  outstandingAmount: Prisma.Decimal,
) {
  return outstandingAmount.equals(ZERO)
    ? "PAID"
    : paidAmount.equals(ZERO)
      ? "UNPAID"
      : "PARTIALLY_PAID";
}

export function isOverdue(
  outstandingAmount: Prisma.Decimal,
  paymentDueDate: Date | null,
  businessDate: Date,
) {
  if (!paymentDueDate || !outstandingAmount.greaterThan(ZERO)) return false;
  return paymentDueDate.getTime() < businessDate.getTime();
}

export function sumMoney(values: Prisma.Decimal[]) {
  return values.reduce((sum, value) => sum.plus(value), ZERO);
}

export function allocatedReturnValue(
  lineTotal: Prisma.Decimal,
  soldQuantity: number,
  returnedBefore: number,
  returnedNow: number,
) {
  const cumulativeBefore = lineTotal
    .times(returnedBefore)
    .dividedBy(soldQuantity)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const cumulativeAfter = lineTotal
    .times(returnedBefore + returnedNow)
    .dividedBy(soldQuantity)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return cumulativeAfter.minus(cumulativeBefore);
}
