import { Injectable, NotFoundException } from "@nestjs/common";
import {
  PaymentStatus,
  PaymentType,
  Prisma,
  PurchasingDocumentStatus,
  SaleStatus,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import {
  allocatedReturnValue,
  settlementStatus,
  sumMoney,
  ZERO,
} from "./finance-money";

type DbClient = Prisma.TransactionClient | PrismaService;
type ReturnAllocation = {
  id: string;
  items: Array<{ itemId: string; quantity: number }>;
};

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
      settlementStatus: settlementStatus(paidAmount, outstandingAmount),
      payments,
    };
  }

  async saleReturn(saleReturnId: string, client: DbClient = this.prisma) {
    const saleReturn = await client.saleReturn.findUnique({
      where: { id: saleReturnId },
      select: { id: true, saleId: true },
    });
    if (!saleReturn) throw new NotFoundException("Sale Return not found");
    const returnValue = await this.saleReturnValue(
      saleReturn.saleId,
      saleReturnId,
      client,
    );
    const refunds = await client.payment.findMany({
      where: { saleReturnId },
      include: { paymentMethod: true },
      orderBy: [{ createdAt: "asc" }, { number: "asc" }],
    });
    const saleSummary = await this.sale(saleReturn.saleId, client);
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

  async purchase(purchaseId: string, client: DbClient = this.prisma) {
    const purchase = await client.purchase.findUnique({
      where: { id: purchaseId },
      select: {
        id: true,
        total: true,
        items: {
          select: { id: true, orderedQuantity: true, lineTotal: true },
        },
        returns: {
          where: { status: PurchasingDocumentStatus.POSTED },
          select: {
            id: true,
            items: {
              select: { purchaseItemId: true, quantityReturned: true },
            },
          },
          orderBy: [{ postedAt: "asc" }, { number: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!purchase) throw new NotFoundException("Purchase not found");
    const payments = await client.payment.findMany({
      where: { purchaseId },
      include: { paymentMethod: true },
      orderBy: [{ createdAt: "asc" }, { number: "asc" }],
    });
    const returnValues = this.allocateValues(
      purchase.items.map((item) => ({
        id: item.id,
        quantity: item.orderedQuantity,
        lineTotal: item.lineTotal,
      })),
      purchase.returns.map((purchaseReturn) => ({
        id: purchaseReturn.id,
        items: purchaseReturn.items.map((item) => ({
          itemId: item.purchaseItemId,
          quantity: item.quantityReturned,
        })),
      })),
    );
    const purchaseReturnValue = sumMoney([...returnValues.values()]);
    const netPurchaseObligation = Prisma.Decimal.max(
      purchase.total.minus(purchaseReturnValue),
      ZERO,
    );
    const paidAmount = this.total(
      payments,
      PaymentType.PURCHASE_PAYMENT,
      PaymentStatus.POSTED,
    );
    const supplierRefundedAmount = this.total(
      payments,
      PaymentType.SUPPLIER_REFUND,
      PaymentStatus.POSTED,
    );
    const netPaidAmount = paidAmount.minus(supplierRefundedAmount);
    const outstandingAmount = Prisma.Decimal.max(
      netPurchaseObligation.minus(netPaidAmount),
      ZERO,
    );
    const supplierCreditAmount = Prisma.Decimal.max(
      netPaidAmount.minus(netPurchaseObligation),
      ZERO,
    );
    return {
      grossPurchaseValue: purchase.total,
      purchaseReturnValue,
      netPurchaseObligation,
      paidAmount,
      supplierRefundedAmount,
      netPaidAmount,
      outstandingAmount,
      supplierCreditAmount,
      settlementStatus: settlementStatus(netPaidAmount, outstandingAmount),
      returnValues,
      payments,
    };
  }

  async purchaseReturn(
    purchaseReturnId: string,
    client: DbClient = this.prisma,
  ) {
    const purchaseReturn = await client.purchaseReturn.findUnique({
      where: { id: purchaseReturnId },
      select: { id: true, purchaseId: true },
    });
    if (!purchaseReturn)
      throw new NotFoundException("Purchase Return not found");
    const purchaseSummary = await this.purchase(
      purchaseReturn.purchaseId,
      client,
    );
    const refunds = purchaseSummary.payments.filter(
      (payment) => payment.purchaseReturnId === purchaseReturnId,
    );
    const refundedAmount = this.total(
      refunds,
      PaymentType.SUPPLIER_REFUND,
      PaymentStatus.POSTED,
    );
    const returnValue =
      purchaseSummary.returnValues.get(purchaseReturnId) ?? ZERO;
    const returnRemaining = Prisma.Decimal.max(
      returnValue.minus(refundedAmount),
      ZERO,
    );
    return {
      returnValue,
      refundedAmount,
      refundableAmount: Prisma.Decimal.min(
        returnRemaining,
        purchaseSummary.supplierCreditAmount,
      ),
      refunds,
    };
  }

  async saleReturnValue(saleId: string, targetId: string, client: DbClient) {
    const saleItems = await client.saleItem.findMany({
      where: { saleId },
      select: { id: true, quantity: true, lineTotal: true },
    });
    const returns = await client.saleReturn.findMany({
      where: { saleId, status: SaleStatus.POSTED },
      select: {
        id: true,
        items: { select: { saleItemId: true, quantityReturned: true } },
      },
      orderBy: [{ postedAt: "asc" }, { number: "asc" }, { id: "asc" }],
    });
    return (
      this.allocateValues(
        saleItems.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
        })),
        returns.map((saleReturn) => ({
          id: saleReturn.id,
          items: saleReturn.items.map((item) => ({
            itemId: item.saleItemId,
            quantity: item.quantityReturned,
          })),
        })),
      ).get(targetId) ?? ZERO
    );
  }

  private allocateValues(
    lines: Array<{ id: string; quantity: number; lineTotal: Prisma.Decimal }>,
    returns: ReturnAllocation[],
  ) {
    const lineById = new Map(lines.map((line) => [line.id, line]));
    const cumulative = new Map<string, number>();
    const result = new Map<string, Prisma.Decimal>();
    for (const current of returns) {
      let currentValue = ZERO;
      const quantities = new Map<string, number>();
      for (const item of current.items)
        quantities.set(
          item.itemId,
          (quantities.get(item.itemId) ?? 0) + item.quantity,
        );
      for (const [itemId, quantity] of quantities) {
        const line = lineById.get(itemId);
        if (!line) continue;
        const before = cumulative.get(itemId) ?? 0;
        currentValue = currentValue.plus(
          allocatedReturnValue(line.lineTotal, line.quantity, before, quantity),
        );
        cumulative.set(itemId, before + quantity);
      }
      result.set(current.id, currentValue);
    }
    return result;
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
