import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CashMovementType, CashSessionStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { CashLedgerService } from "./cash-ledger.service";
import {
  CloseCashSessionDto,
  CreateManualCashMovementDto,
  OpenCashSessionDto,
} from "./dto/cash-session.dto";
import { ListCashSessionsQueryDto } from "./dto/list-cash-sessions-query.dto";
import { money, movementDelta, positiveMoney, ZERO } from "./finance-money";

@Injectable()
export class CashSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: CashLedgerService,
  ) {}

  async open(cashRegisterId: string, dto: OpenCashSessionDto, actorId: string) {
    const openingAmount = money(dto.openingAmount, "openingAmount");
    return this.prisma.runSerializable(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "CashRegister" WHERE "id" = ${cashRegisterId}::uuid FOR UPDATE`;
      const register = await tx.cashRegister.findUnique({
        where: { id: cashRegisterId },
      });
      if (!register) throw new NotFoundException("Cash Register not found");
      if (!register.active)
        throw new ConflictException("Cash Register is inactive");
      const current = await tx.cashSession.findFirst({
        where: { cashRegisterId, status: CashSessionStatus.OPEN },
      });
      if (current)
        throw new ConflictException(
          "Cash Register already has an OPEN session",
        );
      try {
        return await tx.cashSession.create({
          data: {
            cashRegisterId,
            openingAmount,
            openedByActorId: actorId,
            openingNotes: dto.notes?.trim(),
          },
          include: { cashRegister: true },
        });
      } catch (error: unknown) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        )
          throw new ConflictException(
            "Cash Register already has an OPEN session",
          );
        throw error;
      }
    });
  }

  async findAll(query: ListCashSessionsQueryDto) {
    const where: Prisma.CashSessionWhereInput = {
      cashRegisterId: query.cashRegisterId,
      status: query.status,
      openedByActorId: query.openedByActorId,
      openedAt:
        query.openedFrom || query.openedTo
          ? { gte: query.openedFrom, lte: query.openedTo }
          : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.cashSession.findMany({
        where,
        include: { cashRegister: true },
        orderBy: [{ openedAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.cashSession.count({ where }),
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

  async findOne(id: string) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id },
      include: { cashRegister: true },
    });
    if (!session) throw new NotFoundException("Cash Session not found");
    return session;
  }

  async createMovement(
    id: string,
    dto: CreateManualCashMovementDto,
    actorId: string,
  ) {
    const amount = positiveMoney(dto.amount);
    return this.prisma.runSerializable(async (tx) => {
      const session = await this.ledger.lockOpenActiveSession(tx, id);
      if (dto.type === CashMovementType.MANUAL_OUT)
        await this.ledger.ensureOutflowAvailable(
          tx,
          id,
          session.openingAmount,
          amount,
        );
      return tx.cashMovement.create({
        data: this.ledger.movementData(
          id,
          dto.type,
          amount,
          actorId,
          undefined,
          dto.reason,
        ),
      });
    });
  }

  async close(id: string, dto: CloseCashSessionDto, actorId: string) {
    const countedAmount = money(dto.countedAmount, "countedAmount");
    return this.prisma.runSerializable(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "CashSession" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const session = await tx.cashSession.findUnique({ where: { id } });
      if (!session) throw new NotFoundException("Cash Session not found");
      if (session.status !== CashSessionStatus.OPEN)
        throw new ConflictException("Cash Session is already closed");
      const expectedAmount = await this.ledger.expected(
        tx,
        id,
        session.openingAmount,
      );
      const differenceAmount = countedAmount.minus(expectedAmount);
      const notes = dto.notes?.trim();
      if (!differenceAmount.equals(ZERO) && (!notes || notes.length < 3))
        throw new BadRequestException(
          "Closing notes are required when counted Cash differs from expected Cash",
        );
      return tx.cashSession.update({
        where: { id },
        data: {
          status: CashSessionStatus.CLOSED,
          expectedAmount,
          countedAmount,
          differenceAmount,
          closingNotes: notes,
          closedByActorId: actorId,
          closedAt: new Date(),
        },
        include: { cashRegister: true },
      });
    });
  }

  async summary(id: string) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id },
      include: {
        cashRegister: true,
        movements: {
          include: { payment: { include: { paymentMethod: true } } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!session) throw new NotFoundException("Cash Session not found");
    const totals = Object.values(CashMovementType).reduce<
      Record<string, Prisma.Decimal>
    >((all, type) => ({ ...all, [type]: ZERO }), {});
    for (const movement of session.movements)
      totals[movement.type] = totals[movement.type].plus(movement.amount);
    const liveExpected = session.movements.reduce(
      (value, movement) =>
        value.plus(movementDelta(movement.type, movement.amount)),
      session.openingAmount,
    );
    const byMethod = new Map<
      string,
      {
        paymentMethod: unknown;
        payments: Prisma.Decimal;
        refunds: Prisma.Decimal;
        purchasePayments: Prisma.Decimal;
        supplierRefunds: Prisma.Decimal;
      }
    >();
    for (const movement of session.movements) {
      if (!movement.payment) continue;
      const key = movement.payment.paymentMethodId;
      const row = byMethod.get(key) ?? {
        paymentMethod: movement.payment.paymentMethod,
        payments: ZERO,
        refunds: ZERO,
        purchasePayments: ZERO,
        supplierRefunds: ZERO,
      };
      if (movement.type === CashMovementType.SALE_PAYMENT)
        row.payments = row.payments.plus(movement.amount);
      if (movement.type === CashMovementType.SALE_REFUND)
        row.refunds = row.refunds.plus(movement.amount);
      if (movement.type === CashMovementType.PURCHASE_PAYMENT)
        row.purchasePayments = row.purchasePayments.plus(movement.amount);
      if (movement.type === CashMovementType.SUPPLIER_REFUND)
        row.supplierRefunds = row.supplierRefunds.plus(movement.amount);
      byMethod.set(key, row);
    }
    return {
      ...session,
      movements: session.movements,
      movementTotals: totals,
      expectedCash:
        session.status === CashSessionStatus.CLOSED
          ? session.expectedAmount
          : liveExpected,
      paymentTotalsByMethod: [...byMethod.values()],
    };
  }
}
