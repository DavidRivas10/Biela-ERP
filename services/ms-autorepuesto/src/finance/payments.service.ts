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
  SaleStatus,
} from "@prisma/client";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { PrismaService } from "../database/prisma.service";
import { CashLedgerService } from "./cash-ledger.service";
import {
  CreateSalePaymentDto,
  CreateSaleRefundDto,
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
      const cash = await this.resolveCash(tx, method.kind, dto, amount);
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
        await tx.cashMovement.create({
          data: this.ledger.movementData(
            cash.session.id,
            CashMovementType.SALE_PAYMENT,
            amount,
            actorId,
            payment.id,
          ),
        });
      return tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
        include: paymentInclude,
      });
    });
  }

  async createRefund(
    saleReturnId: string,
    dto: CreateSaleRefundDto,
    actorId: string,
  ) {
    const amount = positiveMoney(dto.amount);
    if (dto.tenderedAmount)
      throw new BadRequestException("tenderedAmount is not valid for a Refund");
    const identity = await this.prisma.saleReturn.findUnique({
      where: { id: saleReturnId },
      select: { saleId: true },
    });
    if (!identity) throw new NotFoundException("Sale Return not found");
    return this.prisma.runSerializable(async (tx) => {
      await this.lockSale(tx, identity.saleId);
      await tx.$queryRaw`SELECT "id" FROM "SaleReturn" WHERE "id" = ${saleReturnId}::uuid FOR UPDATE`;
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
      const cash = await this.resolveCash(tx, method.kind, dto, amount, true);
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
        await tx.cashMovement.create({
          data: this.ledger.movementData(
            cash.session.id,
            CashMovementType.SALE_REFUND,
            amount,
            actorId,
            payment.id,
          ),
        });
      return tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
        include: paymentInclude,
      });
    });
  }

  async findSalePayments(saleId: string, query: PaginationQueryDto) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      select: { id: true },
    });
    if (!sale) throw new NotFoundException("Sale not found");
    return this.page({ saleId, type: PaymentType.SALE_PAYMENT }, query);
  }
  async findRefunds(saleReturnId: string, query: PaginationQueryDto) {
    const saleReturn = await this.prisma.saleReturn.findUnique({
      where: { id: saleReturnId },
      select: { id: true },
    });
    if (!saleReturn) throw new NotFoundException("Sale Return not found");
    return this.page({ saleReturnId, type: PaymentType.SALE_REFUND }, query);
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
      select: { saleId: true },
    });
    if (!identity) throw new NotFoundException("Payment not found");
    return this.prisma.runSerializable(async (tx) => {
      await this.lockSale(tx, identity.saleId);
      await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const payment = await tx.payment.findUnique({ where: { id } });
      if (!payment) throw new NotFoundException("Payment not found");
      if (payment.status !== PaymentStatus.POSTED)
        throw new ConflictException("Payment is already reversed");
      if (payment.type === PaymentType.SALE_PAYMENT) {
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
        if (payment.type === PaymentType.SALE_PAYMENT)
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
      const reversed = await tx.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.REVERSED,
          reversedAt: new Date(),
          reversedByActorId: actorId,
          reversalReason: dto.reason.trim(),
          reversalCashSessionId: reversalSessionId,
        },
      });
      if (reversalSessionId) {
        const type =
          payment.type === PaymentType.SALE_PAYMENT
            ? CashMovementType.SALE_PAYMENT_REVERSAL
            : CashMovementType.SALE_REFUND_REVERSAL;
        await tx.cashMovement.create({
          data: this.ledger.movementData(
            reversalSessionId,
            type,
            payment.amount,
            actorId,
            payment.id,
            dto.reason,
          ),
        });
      }
      return tx.payment.findUniqueOrThrow({
        where: { id: reversed.id },
        include: paymentInclude,
      });
    });
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
    dto: CreateSalePaymentDto,
    amount: Prisma.Decimal,
    refund = false,
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
    if (refund) return { session, tendered: undefined, change: undefined };
    const tendered = dto.tenderedAmount
      ? positiveMoney(dto.tenderedAmount, "tenderedAmount")
      : amount;
    if (tendered.lessThan(amount))
      throw new BadRequestException(
        "tenderedAmount cannot be less than amount",
      );
    return { session, tendered, change: tendered.minus(amount) };
  }

  private async lockSale(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "Sale" WHERE "id" = ${id}::uuid FOR UPDATE`;
  }
}
