import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { throwMappedPrismaError } from "../database/prisma-error.util";
import {
  CreateCashRegisterDto,
  UpdateCashRegisterDto,
} from "./dto/cash-register.dto";
import { ListCashRegistersQueryDto } from "./dto/list-cash-registers-query.dto";

@Injectable()
export class CashRegistersService {
  constructor(private readonly prisma: PrismaService) {}
  async create(dto: CreateCashRegisterDto) {
    try {
      return await this.prisma.cashRegister.create({
        data: this.data(dto) as Prisma.CashRegisterCreateInput,
      });
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Cash Register code already exists");
    }
  }
  async findAll(query: ListCashRegistersQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.CashRegisterWhereInput = {
      code: query.code
        ? { contains: query.code.trim(), mode: "insensitive" }
        : undefined,
      active: query.active,
      OR: search
        ? [
            { code: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
          ]
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.cashRegister.findMany({
        where,
        orderBy: [{ code: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.cashRegister.count({ where }),
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
    const result = await this.prisma.cashRegister.findUnique({ where: { id } });
    if (!result) throw new NotFoundException("Cash Register not found");
    return result;
  }
  async update(id: string, dto: UpdateCashRegisterDto) {
    await this.findOne(id);
    try {
      return await this.prisma.cashRegister.update({
        where: { id },
        data: this.data(dto),
      });
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Cash Register code already exists");
    }
  }
  async setActive(id: string, active: boolean) {
    await this.findOne(id);
    return this.prisma.cashRegister.update({ where: { id }, data: { active } });
  }
  async currentSession(id: string) {
    await this.findOne(id);
    return this.prisma.cashSession.findFirst({
      where: { cashRegisterId: id, status: "OPEN" },
      include: { cashRegister: true },
      orderBy: [{ openedAt: "desc" }, { id: "desc" }],
    });
  }
  private data(dto: CreateCashRegisterDto | UpdateCashRegisterDto) {
    return {
      code: dto.code?.trim().toUpperCase(),
      name: dto.name?.trim(),
      description: dto.description?.trim(),
      active: dto.active,
    };
  }
}
