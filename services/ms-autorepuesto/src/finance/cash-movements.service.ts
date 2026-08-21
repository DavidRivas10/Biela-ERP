import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { ListCashMovementsQueryDto } from "./dto/list-cash-movements-query.dto";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class CashMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListCashMovementsQueryDto) {
    const reference = query.reference?.trim();
    const paymentReferenceFilters: Prisma.PaymentWhereInput[] = [];
    if (reference) {
      paymentReferenceFilters.push({
        externalReference: { contains: reference, mode: "insensitive" },
      });
      if (/^\d+$/.test(reference))
        paymentReferenceFilters.push({ number: Number(reference) });
      if (UUID_PATTERN.test(reference)) {
        paymentReferenceFilters.push(
          { id: reference },
          { saleId: reference },
          { saleReturnId: reference },
          { purchaseId: reference },
          { purchaseReturnId: reference },
        );
      }
    }

    const where: Prisma.CashMovementWhereInput = {
      cashSessionId: query.cashSessionId,
      type: query.type,
      paymentId: query.paymentId,
      cashSession: query.cashRegisterId
        ? { cashRegisterId: query.cashRegisterId }
        : undefined,
      payment:
        paymentReferenceFilters.length > 0
          ? { is: { OR: paymentReferenceFilters } }
          : undefined,
      createdAt:
        query.createdFrom || query.createdTo
          ? { gte: query.createdFrom, lte: query.createdTo }
          : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.cashMovement.findMany({
        where,
        include: {
          cashSession: { include: { cashRegister: true } },
          payment: { include: { paymentMethod: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.cashMovement.count({ where }),
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
}
