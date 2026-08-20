import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CashMovementType,
  PaymentMethodKind,
  PaymentStatus,
  PaymentType,
  Prisma,
  PurchaseStatus,
  PurchasingDocumentStatus,
  SaleStatus,
} from "@prisma/client";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { PrismaService } from "../database/prisma.service";
import { CashLedgerService } from "./cash-ledger.service";
import {
  CreateFinancialOperationDto,
  CreatePurchasePaymentDto,
  CreateSalePaymentDto,
  CreateSaleRefundDto,
  CreateSupplierRefundDto,
  ReversePaymentDto,
} from "./dto/payment.dto";
import { FinancialSummaryService } from "./financial-summary.service";
import { positiveMoney } from "./finance-money";

const paymentInclude = {
  paymentMethod: true,
  cashSession: { include: { cashRegister: true } },
  reversalCashSession: { include: { cashRegister: true } },
  sale: { select: { id: true, number: true, total: true } },
  saleReturn: { select: { id: true, number: true } },
  purchase: { select: { id: true, number: true, total: true } },
  purchaseReturn: { select: { id: true, number: true } },
  cashMovements: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.PaymentInclude;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: CashLedgerService,
    private readonly summaries: FinancialSummaryService,
  ) {}

  async createSalePayment(
    saleId: string,
    dto: CreateSalePaymentDto,
    actorId: string,
  ) {
    const amount = positiveMoney(dto.amount);
    return this.prisma.runSerializable(async (tx) => {
      await this.lockSale(tx, saleId);
      const sale = await tx.sale.findUnique({ where: { id: saleId } });
      if (!sale) throw new NotFoundException("Sale not found");
      if (sale.status !== SaleStatus.POSTED)
        throw new ConflictException("Only a POSTED Sale can receive Payments");
      const method = await this.activeMethod(tx, dto.paymentMethodId);
      const summary = await this.summaries.sale(saleId, tx);
      if (amount.greaterThan(summary.outstandingAmount))
        throw new ConflictException("Payment exceeds Sale outstanding amount");
      const cash = await this.resolveCash(tx, method.kind, dto, amount, true);
      const payment = await tx.payment.create({
        data: {
          type: PaymentType.SALE_PAYMENT,
          saleId,
          paymentMethodId: method.id,
          cashSessionId: cash?.session.id,
          amount,
          tenderedAmount: cash?.tendered,
          changeAmount: cash?.change,
          externalReference: dto.externalReference?.trim(),
          notes: dto.notes?.trim(),
          createdByActorId: actorId,
        },
      });
      if (cash)
        await this.createCashMovement(
          tx,
          cash.session.id,
          CashMovementType.SALE_PAYMENT,
          amount,
          actorId,
          payment.id,
        );
      return this.payment(tx, payment.id);
    });
  }

  async createSaleRefund(
    saleReturnId: string,
    dto: CreateSaleRefundDto,
    actorId: string,
  ) {
    const amount = positiveMoney(dto.amount);
    const identity = await this.prisma.saleReturn.findUnique({
      where: { id: saleReturnId },
      select: { saleId: true },
    });
    if (!identity) throw new NotFoundException("Sale Return not found");
    return this.prisma.runSerializable(async (tx) => {
      await this.lockSale(tx, identity.saleId);
      await this.lockSaleReturn(tx, saleReturnId);
      const saleReturn = await tx.saleReturn.findUnique({
        where: { id: saleReturnId },
        include: { sale: true },
      });
      if (!saleReturn) throw new NotFoundException("Sale Return not found");
      if (
        saleReturn.status !== SaleStatus.POSTED ||
        saleReturn.sale.status !== SaleStatus.POSTED
      )
        throw new ConflictException(
          "Only a POSTED Sale Return for a POSTED Sale can be refunded",
        );
      const method = await this.activeMethod(tx, dto.paymentMethodId);
      const summary = await this.summaries.saleReturn(saleReturnId, tx);
      if (amount.greaterThan(summary.refundableAmount))
        throw new ConflictException(
          "Refund exceeds currently refundable amount",
        );
      const cash = await this.resolveCash(tx, method.kind, dto, amount);
      if (cash)
        await this.ledger.ensureOutflowAvailable(
          tx,
          cash.session.id,
          cash.session.openingAmount,
          amount,
        );
      const payment = await tx.payment.create({
        data: {
          type: PaymentType.SALE_REFUND,
          saleId: saleReturn.saleId,
          saleReturnId,
          paymentMethodId: method.id,
          cashSessionId: cash?.session.id,
          amount,
          externalReference: dto.externalReference?.trim(),
          notes: dto.notes?.trim(),
          createdByActorId: actorId,
        },
      });
      if (cash)
        await this.createCashMovement(
          tx,
          cash.session.id,
          CashMovementType.SALE_REFUND,
          amount,
          actorId,
          payment.id,
        );
      return this.payment(tx, payment.id);
    });
  }

  async createPurchasePayment(
    purchaseId: string,
    dto: CreatePurchasePaymentDto,
    actorId: string,
  ) {
    const amount = positiveMoney(dto.amount);
    return this.prisma.runSerializable(async (tx) => {
      await this.lockPurchase(tx, purchaseId);
      const purchase = await tx.purchase.findUnique({
        where: { id: purchaseId },
      });
      if (!purchase) throw new NotFoundException("Purchase not found");
      if (
        purchase.status !== PurchaseStatus.CONFIRMED &&
        purchase.status !== PurchaseStatus.PARTIALLY_RECEIVED &&
        purchase.status !== PurchaseStatus.RECEIVED
      )
        throw new ConflictException(
          "Only a confirmed or received Purchase can receive Payments",
        );
      const method = await this.activeMethod(tx, dto.paymentMethodId);
      const summary = await this.summaries.purchase(purchaseId, tx);
      if (amount.greaterThan(summary.outstandingAmount))
        throw new ConflictException(
          "Payment exceeds Purchase outstanding amount",
        );
      const cash = await this.resolveCash(tx, method.kind, dto, amount);
      if (cash)
        await this.ledger.ensureOutflowAvailable(
          tx,
          cash.session.id,
          cash.session.openingAmount,
          amount,
        );
      const payment = await tx.payment.create({
        data: {
          type: PaymentType.PURCHASE_PAYMENT,
          purchaseId,
          paymentMethodId: method.id,
          cashSessionId: cash?.session.id,
          amount,
          externalReference: dto.externalReference?.trim(),
          notes: dto.notes?.trim(),
          createdByActorId: actorId,
        },
      });
      if (cash)
        await this.createCashMovement(
          tx,
          cash.session.id,
          CashMovementType.PURCHASE_PAYMENT,
          amount,
          actorId,
          payment.id,
        );
      return this.payment(tx, payment.id);
    });
  }

  async createSupplierRefund(
    purchaseReturnId: string,
    dto: CreateSupplierRefundDto,
    actorId: string,
  ) {
    const amount = positiveMoney(dto.amount);
    const identity = await this.prisma.purchaseReturn.findUnique({
      where: { id: purchaseReturnId },
      select: { purchaseId: true },
    });
    if (!identity) throw new NotFoundException("Purchase Return not found");
    return this.prisma.runSerializable(async (tx) => {
      await this.lockPurchase(tx, identity.purchaseId);
      await this.lockPurchaseReturn(tx, purchaseReturnId);
      const purchaseReturn = await tx.purchaseReturn.findUnique({
        where: { id: purchaseReturnId },
      });
      if (!purchaseReturn)
        throw new NotFoundException("Purchase Return not found");
      if (purchaseReturn.status !== PurchasingDocumentStatus.POSTED)
        throw new ConflictException(
          "Only a POSTED Purchase Return can receive a Supplier Refund",
        );
      const method = await this.activeMethod(tx, dto.paymentMethodId);
      const summary = await this.summaries.purchaseReturn(purchaseReturnId, tx);
      if (amount.greaterThan(summary.refundableAmount))
        throw new ConflictException(
          "Supplier Refund exceeds currently refundable Supplier credit",
        );
      const cash = await this.resolveCash(tx, method.kind, dto, amount);
      const payment = await tx.payment.create({
        data: {
          type: PaymentType.SUPPLIER_REFUND,
          purchaseId: identity.purchaseId,
          purchaseReturnId,
          paymentMethodId: method.id,
          cashSessionId: cash?.session.id,
          amount,
          externalReference: dto.externalReference?.trim(),
          notes: dto.notes?.trim(),
          createdByActorId: actorId,
        },
      });
      if (cash)
        await this.createCashMovement(
          tx,
          cash.session.id,
          CashMovementType.SUPPLIER_REFUND,
          amount,
          actorId,
          payment.id,
        );
      return this.payment(tx, payment.id);
    });
  }

  findSalePayments(saleId: string, query: PaginationQueryDto) {
    return this.pageForExisting(
      "sale",
      saleId,
      { saleId, type: PaymentType.SALE_PAYMENT },
      query,
    );
  }

  findSaleRefunds(saleReturnId: string, query: PaginationQueryDto) {
    return this.pageForExisting(
      "saleReturn",
      saleReturnId,
      { saleReturnId, type: PaymentType.SALE_REFUND },
      query,
    );
  }

  findPurchasePayments(purchaseId: string, query: PaginationQueryDto) {
    return this.pageForExisting(
      "purchase",
      purchaseId,
      { purchaseId, type: PaymentType.PURCHASE_PAYMENT },
      query,
    );
  }

  findSupplierRefunds(purchaseReturnId: string, query: PaginationQueryDto) {
    return this.pageForExisting(
      "purchaseReturn",
      purchaseReturnId,
      { purchaseReturnId, type: PaymentType.SUPPLIER_REFUND },
      query,
    );
  }

  async findOne(id: string) {
    const result = await this.prisma.payment.findUnique({
      where: { id },
      include: paymentInclude,
    });
    if (!result) throw new NotFoundException("Payment not found");
    return result;
  }

  async reverse(id: string, dto: ReversePaymentDto, actorId: string) {
    const identity = await this.prisma.payment.findUnique({
      where: { id },
      select: {
        type: true,
        saleId: true,
        saleReturnId: true,
        purchaseId: true,
        purchaseReturnId: true,
      },
    });
    if (!identity) throw new NotFoundException("Payment not found");
    return this.prisma.runSerializable(async (tx) => {
      if (identity.saleId) {
        await this.lockSale(tx, identity.saleId);
        if (identity.saleReturnId)
          await this.lockSaleReturn(tx, identity.saleReturnId);
      } else if (identity.purchaseId) {
        await this.lockPurchase(tx, identity.purchaseId);
        if (identity.purchaseReturnId)
          await this.lockPurchaseReturn(tx, identity.purchaseReturnId);
      }
      await this.lockPayment(tx, id);
      const payment = await tx.payment.findUnique({ where: { id } });
      if (!payment) throw new NotFoundException("Payment not found");
      if (payment.status !== PaymentStatus.POSTED)
        throw new ConflictException("Payment is already reversed");
      if (payment.type === PaymentType.SALE_PAYMENT && payment.saleId) {
        const summary = await this.summaries.sale(payment.saleId, tx);
        if (
          summary.paidAmount
            .minus(payment.amount)
            .lessThan(summary.refundedAmount)
        )
          throw new ConflictException(
            "Payment reversal would leave active Refunds greater than active Payments",
          );
      }
      if (payment.type === PaymentType.PURCHASE_PAYMENT && payment.purchaseId) {
        const summary = await this.summaries.purchase(payment.purchaseId, tx);
        if (
          summary.paidAmount
            .minus(payment.amount)
            .lessThan(summary.supplierRefundedAmount)
        )
          throw new ConflictException(
            "Payment reversal would leave Supplier Refunds greater than Purchase Payments",
          );
      }
      let reversalSessionId: string | undefined;
      if (payment.cashSessionId) {
        if (!dto.cashSessionId)
          throw new BadRequestException(
            "cashSessionId is required to reverse a Cash operation",
          );
        const session = await this.ledger.lockOpenActiveSession(
          tx,
          dto.cashSessionId,
        );
        reversalSessionId = session.id;
        if (
          payment.type === PaymentType.SALE_PAYMENT ||
          payment.type === PaymentType.SUPPLIER_REFUND
        )
          await this.ledger.ensureOutflowAvailable(
            tx,
            session.id,
            session.openingAmount,
            payment.amount,
          );
      } else if (dto.cashSessionId)
        throw new BadRequestException(
          "cashSessionId is not valid for a non-Cash reversal",
        );
      await tx.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.REVERSED,
          reversedAt: new Date(),
          reversedByActorId: actorId,
          reversalReason: dto.reason.trim(),
          reversalCashSessionId: reversalSessionId,
        },
      });
      if (reversalSessionId)
        await this.createCashMovement(
          tx,
          reversalSessionId,
          this.reversalMovementType(payment.type),
          payment.amount,
          actorId,
          payment.id,
          dto.reason,
        );
      return this.payment(tx, id);
    });
  }

  private async pageForExisting(
    model: "sale" | "saleReturn" | "purchase" | "purchaseReturn",
    id: string,
    where: Prisma.PaymentWhereInput,
    query: PaginationQueryDto,
  ) {
    const exists =
      model === "sale"
        ? await this.prisma.sale.findUnique({
            where: { id },
            select: { id: true },
          })
        : model === "saleReturn"
          ? await this.prisma.saleReturn.findUnique({
              where: { id },
              select: { id: true },
            })
          : model === "purchase"
            ? await this.prisma.purchase.findUnique({
                where: { id },
                select: { id: true },
              })
            : await this.prisma.purchaseReturn.findUnique({
                where: { id },
                select: { id: true },
              });
    if (!exists)
      throw new NotFoundException(
        `${model === "saleReturn" ? "Sale Return" : model === "purchaseReturn" ? "Purchase Return" : model[0].toUpperCase() + model.slice(1)} not found`,
      );
    return this.page(where, query);
  }

  private async page(
    where: Prisma.PaymentWhereInput,
    query: PaginationQueryDto,
  ) {
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: paymentInclude,
        orderBy: [{ createdAt: "asc" }, { number: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  private async activeMethod(tx: Prisma.TransactionClient, id: string) {
    const method = await tx.paymentMethod.findUnique({ where: { id } });
    if (!method) throw new NotFoundException("Payment Method not found");
    if (!method.active)
      throw new ConflictException("Payment Method is inactive");
    return method;
  }

  private async resolveCash(
    tx: Prisma.TransactionClient,
    kind: PaymentMethodKind,
    dto: CreateFinancialOperationDto & { tenderedAmount?: string },
    amount: Prisma.Decimal,
    allowTender = false,
  ) {
    if (kind !== PaymentMethodKind.CASH) {
      if (dto.cashSessionId || dto.tenderedAmount)
        throw new BadRequestException(
          "Cash Session and tendered amount are only valid for CASH",
        );
      return undefined;
    }
    if (!dto.cashSessionId)
      throw new BadRequestException("cashSessionId is required for CASH");
    const session = await this.ledger.lockOpenActiveSession(
      tx,
      dto.cashSessionId,
    );
    if (!allowTender || !dto.tenderedAmount)
      return { session, tendered: undefined, change: undefined };
    const tendered = positiveMoney(dto.tenderedAmount, "tenderedAmount");
    if (tendered.lessThan(amount))
      throw new BadRequestException(
        "tenderedAmount cannot be less than amount",
      );
    return { session, tendered, change: tendered.minus(amount) };
  }

  private createCashMovement(
    tx: Prisma.TransactionClient,
    sessionId: string,
    type: CashMovementType,
    amount: Prisma.Decimal,
    actorId: string,
    paymentId: string,
    reason?: string,
  ) {
    return tx.cashMovement.create({
      data: this.ledger.movementData(
        sessionId,
        type,
        amount,
        actorId,
        paymentId,
        reason,
      ),
    });
  }

  private payment(tx: Prisma.TransactionClient, id: string) {
    return tx.payment.findUniqueOrThrow({
      where: { id },
      include: paymentInclude,
    });
  }

  private reversalMovementType(type: PaymentType) {
    const types: Record<PaymentType, CashMovementType> = {
      SALE_PAYMENT: CashMovementType.SALE_PAYMENT_REVERSAL,
      SALE_REFUND: CashMovementType.SALE_REFUND_REVERSAL,
      PURCHASE_PAYMENT: CashMovementType.PURCHASE_PAYMENT_REVERSAL,
      SUPPLIER_REFUND: CashMovementType.SUPPLIER_REFUND_REVERSAL,
    };
    return types[type];
  }

  private lockSale(tx: Prisma.TransactionClient, id: string) {
    return tx.$queryRaw`SELECT "id" FROM "Sale" WHERE "id" = ${id}::uuid FOR UPDATE`;
  }

  private lockSaleReturn(tx: Prisma.TransactionClient, id: string) {
    return tx.$queryRaw`SELECT "id" FROM "SaleReturn" WHERE "id" = ${id}::uuid FOR UPDATE`;
  }

  private lockPurchase(tx: Prisma.TransactionClient, id: string) {
    return tx.$queryRaw`SELECT "id" FROM "Purchase" WHERE "id" = ${id}::uuid FOR UPDATE`;
  }

  private lockPurchaseReturn(tx: Prisma.TransactionClient, id: string) {
    return tx.$queryRaw`SELECT "id" FROM "PurchaseReturn" WHERE "id" = ${id}::uuid FOR UPDATE`;
  }

  private lockPayment(tx: Prisma.TransactionClient, id: string) {
    return tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${id}::uuid FOR UPDATE`;
  }
}
