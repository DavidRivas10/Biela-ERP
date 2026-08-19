import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export interface SaleMoneyInput {
  productId: string;
  sourceLocationId: string;
  quantity: number;
  unitPrice: string | Prisma.Decimal;
  discountAmount?: string | Prisma.Decimal;
  taxAmount?: string | Prisma.Decimal;
}

export function calculateSaleMoney(items: SaleMoneyInput[]) {
  const calculatedItems = items.map(calculateSaleItem);
  const zero = new Prisma.Decimal(0);
  const subtotal = calculatedItems.reduce(
    (sum, item) => sum.plus(item.lineSubtotal),
    zero,
  );
  const discountTotal = calculatedItems.reduce(
    (sum, item) => sum.plus(item.discountAmount),
    zero,
  );
  const taxTotal = calculatedItems.reduce(
    (sum, item) => sum.plus(item.taxAmount),
    zero,
  );
  return {
    items: calculatedItems,
    subtotal,
    discountTotal,
    taxTotal,
    total: subtotal.minus(discountTotal).plus(taxTotal),
  };
}

function calculateSaleItem(item: SaleMoneyInput) {
  const unitPrice = decimal(item.unitPrice, "unitPrice");
  const discountAmount = decimal(item.discountAmount ?? "0", "discountAmount");
  const taxAmount = decimal(item.taxAmount ?? "0", "taxAmount");
  const lineSubtotal = unitPrice
    .times(item.quantity)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (discountAmount.greaterThan(lineSubtotal))
    throw new BadRequestException(
      "Sale item discount cannot exceed its subtotal",
    );
  return {
    productId: item.productId,
    sourceLocationId: item.sourceLocationId,
    quantity: item.quantity,
    unitPrice,
    discountAmount,
    taxAmount,
    lineSubtotal,
    lineTotal: lineSubtotal.minus(discountAmount).plus(taxAmount),
  };
}

function decimal(value: string | Prisma.Decimal, field: string) {
  const result = new Prisma.Decimal(value);
  if (result.isNegative())
    throw new BadRequestException(`${field} cannot be negative`);
  return result;
}
