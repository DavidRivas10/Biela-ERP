import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CashMovementType, CashSessionStatus, Prisma } from "@prisma/client";
import { movementDelta, ZERO } from "./finance-money";

@Injectable()
export class CashLedgerService {
  async lockOpenActiveSession(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "CashSession" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const session = await tx.cashSession.findUnique({
      where: { id },
      include: { cashRegister: true },
    });
    if (!session) throw new NotFoundException("Cash Session not found");
    if (session.status !== CashSessionStatus.OPEN)
      throw new ConflictException("Cash Session is closed");
    if (!session.cashRegister.active)
      throw new ConflictException("Cash Register is inactive");
    return session;
  }

  async expected(
    tx: Prisma.TransactionClient,
    sessionId: string,
    openingAmount: Prisma.Decimal,
  ) {
    const movements = await tx.cashMovement.findMany({
      where: { cashSessionId: sessionId },
      select: { type: true, amount: true },
    });
    return movements.reduce(
      (value, movement) =>
        value.plus(movementDelta(movement.type, movement.amount)),
      openingAmount,
    );
  }

  async ensureOutflowAvailable(
    tx: Prisma.TransactionClient,
    sessionId: string,
    openingAmount: Prisma.Decimal,
    amount: Prisma.Decimal,
  ) {
    const expected = await this.expected(tx, sessionId, openingAmount);
    if (expected.minus(amount).lessThan(ZERO))
      throw new ConflictException("Insufficient expected Cash in session");
    return expected;
  }

  movementData(
    sessionId: string,
    type: CashMovementType,
    amount: Prisma.Decimal,
    actorId: string,
    paymentId?: string,
    reason?: string,
  ): Prisma.CashMovementUncheckedCreateInput {
    return {
      cashSessionId: sessionId,
      paymentId,
      type,
      amount,
      actorId,
      reason: reason?.trim(),
    };
  }
}
