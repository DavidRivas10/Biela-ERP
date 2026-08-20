import { Injectable, NotFoundException } from "@nestjs/common";
import { PaymentStatus, PaymentType, Prisma, SaleStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { allocatedReturnValue, ZERO } from "./finance-money";

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class FinancialSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async sale(saleId: string, client: DbClient = this.prisma) {
    const sale = await client.sale.findUnique({
      where: { id: saleId },
      select: { id: true, total: true },
    });
    if (!sale) throw new NotFoundException("Sale not found");
    const payments = await client.payment.findMany({
      where: { saleId },
      include: { paymentMethod: true },
      orderBy: [{ createdAt: "asc" }, { number: "asc" }],
    });
    const paidAmount = this.total(
      payments,
      PaymentType.SALE_PAYMENT,
      PaymentStatus.POSTED,
    );
    const refundedAmount = this.total(
      payments,
      PaymentType.SALE_REFUND,
      PaymentStatus.POSTED,
    );
    const outstandingAmount = Prisma.Decimal.max(
      sale.total.minus(paidAmount),
      ZERO,
    );
    return {
      saleTotal: sale.total,
      paidAmount,
      outstandingAmount,
      refundedAmount,
      settlementStatus: paidAmount.equals(ZERO)
        ? "UNPAID"
        : outstandingAmount.equals(ZERO)
          ? "PAID"
          : "PARTIALLY_PAID",
      payments,
    };
  }

  async saleReturn(saleReturnId: string, client: DbClient = this.prisma) {
    const saleReturn = await client.saleReturn.findUnique({
      where: { id: saleReturnId },
      select: { id: true, saleId: true },
    });
    if (!saleReturn) throw new NotFoundException("Sale Return not found");
    const [returnValue, refunds, saleSummary] = await Promise.all([
      this.returnValue(saleReturn.saleId, saleReturnId, client),
      client.payment.findMany({
        where: { saleReturnId },
        include: { paymentMethod: true },
        orderBy: [{ createdAt: "asc" }, { number: "asc" }],
      }),
      this.sale(saleReturn.saleId, client),
    ]);
    const refundedAmount = this.total(
      refunds,
      PaymentType.SALE_REFUND,
      PaymentStatus.POSTED,
    );
    const returnRemaining = Prisma.Decimal.max(
      returnValue.minus(refundedAmount),
      ZERO,
    );
    const cashAvailable = Prisma.Decimal.max(
      saleSummary.paidAmount.minus(saleSummary.refundedAmount),
      ZERO,
    );
    return {
      returnValue,
      refundedAmount,
      refundableAmount: Prisma.Decimal.min(returnRemaining, cashAvailable),
      refunds,
    };
  }

  async returnValue(saleId: string, targetId: string, client: DbClient) {
    const saleItems = await client.saleItem.findMany({
      where: { saleId },
      select: { id: true, quantity: true, lineTotal: true },
    });
    const itemById = new Map(saleItems.map((item) => [item.id, item]));
    const returns = await client.saleReturn.findMany({
      where: { saleId, status: SaleStatus.POSTED },
      select: {
        id: true,
        items: { select: { saleItemId: true, quantityReturned: true } },
      },
      orderBy: [{ postedAt: "asc" }, { number: "asc" }, { id: "asc" }],
    });
    const cumulative = new Map<string, number>();
    for (const current of returns) {
      let currentValue = ZERO;
      const quantities = new Map<string, number>();
      for (const item of current.items)
        quantities.set(
          item.saleItemId,
          (quantities.get(item.saleItemId) ?? 0) + item.quantityReturned,
        );
      for (const [saleItemId, quantity] of quantities) {
        const saleItem = itemById.get(saleItemId);
        if (!saleItem) continue;
        const before = cumulative.get(saleItemId) ?? 0;
        const after = before + quantity;
        currentValue = currentValue.plus(
          allocatedReturnValue(
            saleItem.lineTotal,
            saleItem.quantity,
            before,
            quantity,
          ),
        );
        cumulative.set(saleItemId, after);
      }
      if (current.id === targetId) return currentValue;
    }
    return ZERO;
  }

  private total(
    rows: Array<{
      type: PaymentType;
      status: PaymentStatus;
      amount: Prisma.Decimal;
    }>,
    type: PaymentType,
    status: PaymentStatus,
  ) {
    return rows
      .filter((row) => row.type === type && row.status === status)
      .reduce((sum, row) => sum.plus(row.amount), ZERO);
  }
}
