import { BadRequestException } from "@nestjs/common";
import { calculatePurchaseMoney } from "./purchase-money";

describe("purchase exact-money calculation", () => {
  it("uses decimal arithmetic for line and header totals", () => {
    const result = calculatePurchaseMoney([
      {
        productId: "00000000-0000-4000-8000-000000000001",
        orderedQuantity: 3,
        unitCost: "0.10",
        discountAmount: "0.05",
        taxAmount: "0.02",
      },
    ]);
    expect(result.items[0].lineSubtotal.toFixed(2)).toBe("0.30");
    expect(result.subtotal.toFixed(2)).toBe("0.30");
    expect(result.total.toFixed(2)).toBe("0.27");
  });

  it("rounds multiplication boundaries half-up to two line decimals", () => {
    const result = calculatePurchaseMoney([
      {
        productId: "00000000-0000-4000-8000-000000000001",
        orderedQuantity: 3,
        unitCost: "0.335",
      },
    ]);
    expect(result.items[0].lineSubtotal.toFixed(2)).toBe("1.01");
    expect(result.total.toFixed(2)).toBe("1.01");
  });

  it("rejects negative amounts and discounts above line subtotal", () => {
    expect(() =>
      calculatePurchaseMoney([
        {
          productId: "00000000-0000-4000-8000-000000000001",
          orderedQuantity: 1,
          unitCost: "1.00",
          discountAmount: "1.01",
        },
      ]),
    ).toThrow(BadRequestException);
    expect(() =>
      calculatePurchaseMoney([
        {
          productId: "00000000-0000-4000-8000-000000000001",
          orderedQuantity: 1,
          unitCost: "-1.00",
        },
      ]),
    ).toThrow(BadRequestException);
  });
});
