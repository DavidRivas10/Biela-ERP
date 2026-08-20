import { BadRequestException } from "@nestjs/common";
import { CashMovementType, Prisma } from "@prisma/client";
import {
  allocatedReturnValue,
  money,
  movementDelta,
  positiveMoney,
  sumMoney,
} from "./finance-money";

describe("finance money", () => {
  it("keeps exact decimal arithmetic", () => {
    expect(sumMoney([money("0.10"), money("0.20")]).toFixed(2)).toBe("0.30");
  });

  it("rejects invalid precision and non-positive operation amounts", () => {
    expect(() => money("1.001")).toThrow(BadRequestException);
    expect(() => money("-0.01")).toThrow(BadRequestException);
    expect(() => positiveMoney("0")).toThrow(BadRequestException);
  });

  it("maps movement semantics to signed cash effects", () => {
    const amount = new Prisma.Decimal(10);
    expect(movementDelta(CashMovementType.MANUAL_IN, amount).toFixed(2)).toBe(
      "10.00",
    );
    expect(movementDelta(CashMovementType.SALE_REFUND, amount).toFixed(2)).toBe(
      "-10.00",
    );
  });

  it("allocates partial Returns cumulatively and reaches the exact line total", () => {
    const lineTotal = new Prisma.Decimal("10.00");
    const allocations = [
      allocatedReturnValue(lineTotal, 3, 0, 1),
      allocatedReturnValue(lineTotal, 3, 1, 1),
      allocatedReturnValue(lineTotal, 3, 2, 1),
    ];
    expect(allocations.map((value) => value.toFixed(2))).toEqual([
      "3.33",
      "3.34",
      "3.33",
    ]);
    expect(sumMoney(allocations).toFixed(2)).toBe("10.00");
  });
});
