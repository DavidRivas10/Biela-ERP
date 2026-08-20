import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { throwMappedPrismaError } from "../database/prisma-error.util";
import {
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
} from "./dto/payment-method.dto";
import { ListPaymentMethodsQueryDto } from "./dto/list-payment-methods-query.dto";

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePaymentMethodDto) {
    try {
      return await this.prisma.paymentMethod.create({
        data: this.data(dto) as Prisma.PaymentMethodCreateInput,
      });
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Payment Method code already exists");
    }
  }

  async findAll(query: ListPaymentMethodsQueryDto) {
    const where: Prisma.PaymentMethodWhereInput = {
      code: query.code
        ? { contains: query.code.trim(), mode: "insensitive" }
        : undefined,
      kind: query.kind,
      active: query.active,
    };
    const [data, total] = await Promise.all([
      this.prisma.paymentMethod.findMany({
        where,
        orderBy: [{ code: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.paymentMethod.count({ where }),
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
    const result = await this.prisma.paymentMethod.findUnique({
      where: { id },
    });
    if (!result) throw new NotFoundException("Payment Method not found");
    return result;
  }

  async update(id: string, dto: UpdatePaymentMethodDto) {
    const existing = await this.findOne(id);
    if (dto.kind && dto.kind !== existing.kind) {
      const historicalPayments = await this.prisma.payment.count({
        where: { paymentMethodId: id },
      });
      if (historicalPayments)
        throw new ConflictException(
          "Payment Method kind cannot change after financial use",
        );
    }
    try {
      return await this.prisma.paymentMethod.update({
        where: { id },
        data: this.data(dto),
      });
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Payment Method code already exists");
    }
  }

  async setActive(id: string, active: boolean) {
    await this.findOne(id);
    return this.prisma.paymentMethod.update({
      where: { id },
      data: { active },
    });
  }

  private data(dto: CreatePaymentMethodDto | UpdatePaymentMethodDto) {
    return {
      code: dto.code?.trim().toUpperCase(),
      name: dto.name?.trim(),
      kind: dto.kind,
      active: dto.active,
      notes: dto.notes?.trim(),
    };
  }
}
