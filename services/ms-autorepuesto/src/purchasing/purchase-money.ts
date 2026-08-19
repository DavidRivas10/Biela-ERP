import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CreatePurchaseItemDto } from "./dto/purchase.dto";

export interface CalculatedPurchaseItem {
  productId: string;
  orderedQuantity: number;
  unitCost: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  lineSubtotal: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

export function calculatePurchaseMoney(items: CreatePurchaseItemDto[]) {
  const calculatedItems = items.map(calculatePurchaseItem);
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

function calculatePurchaseItem(
  item: CreatePurchaseItemDto,
): CalculatedPurchaseItem {
  const unitCost = decimal(item.unitCost, "unitCost");
  const discountAmount = decimal(item.discountAmount ?? "0", "discountAmount");
  const taxAmount = decimal(item.taxAmount ?? "0", "taxAmount");
  const lineSubtotal = unitCost
    .times(item.orderedQuantity)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (discountAmount.greaterThan(lineSubtotal))
    throw new BadRequestException(
      "Purchase item discount cannot exceed its subtotal",
    );
  return {
    productId: item.productId,
    orderedQuantity: item.orderedQuantity,
    unitCost,
    discountAmount,
    taxAmount,
    lineSubtotal,
    lineTotal: lineSubtotal.minus(discountAmount).plus(taxAmount),
  };
}

function decimal(value: string, field: string): Prisma.Decimal {
  const result = new Prisma.Decimal(value);
  if (result.isNegative())
    throw new BadRequestException(`${field} cannot be negative`);
  return result;
}
