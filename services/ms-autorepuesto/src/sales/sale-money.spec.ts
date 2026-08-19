import { BadRequestException } from "@nestjs/common";
import { calculateSaleMoney } from "./sale-money";

describe("calculateSaleMoney", () => {
  it("uses exact decimals, half-up line rounding, discounts, taxes, and aggregation", () => {
    const result = calculateSaleMoney([
      {
        productId: "p1",
        sourceLocationId: "l1",
        quantity: 3,
        unitPrice: "0.3350",
        discountAmount: "0.01",
        taxAmount: "0.15",
      },
      {
        productId: "p2",
        sourceLocationId: "l1",
        quantity: 2,
        unitPrice: "12.3456",
        discountAmount: "1.00",
        taxAmount: "2.00",
      },
    ]);

    expect(result.items[0].lineSubtotal.toFixed(2)).toBe("1.01");
    expect(result.items[0].lineTotal.toFixed(2)).toBe("1.15");
    expect(result.items[1].lineSubtotal.toFixed(2)).toBe("24.69");
    expect(result.subtotal.toFixed(2)).toBe("25.70");
    expect(result.discountTotal.toFixed(2)).toBe("1.01");
    expect(result.taxTotal.toFixed(2)).toBe("2.15");
    expect(result.total.toFixed(2)).toBe("26.84");
  });

  it("rejects negative money", () => {
    expect(() =>
      calculateSaleMoney([
        {
          productId: "p1",
          sourceLocationId: "l1",
          quantity: 1,
          unitPrice: "-1",
        },
      ]),
    ).toThrow(BadRequestException);
  });

  it("rejects a discount above the line subtotal", () => {
    expect(() =>
      calculateSaleMoney([
        {
          productId: "p1",
          sourceLocationId: "l1",
          quantity: 1,
          unitPrice: "1",
          discountAmount: "1.01",
        },
      ]),
    ).toThrow(BadRequestException);
  });
});
