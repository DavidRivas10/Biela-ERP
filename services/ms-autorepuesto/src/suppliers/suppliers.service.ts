import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { throwMappedPrismaError } from "../database/prisma-error.util";
import { ListSuppliersQueryDto } from "./dto/list-suppliers-query.dto";
import { CreateSupplierDto, UpdateSupplierDto } from "./dto/supplier.dto";

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSupplierDto) {
    try {
      return await this.prisma.supplier.create({
        data: {
          ...this.data(dto),
          code: dto.code.trim().toUpperCase(),
          businessName: dto.businessName.trim(),
        },
      });
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Supplier code already exists");
    }
  }

  async findAll(query: ListSuppliersQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.SupplierWhereInput = {
      active: query.active,
      code: query.code
        ? { contains: query.code, mode: "insensitive" }
        : undefined,
      OR: search
        ? [
            { code: { contains: search, mode: "insensitive" } },
            { businessName: { contains: search, mode: "insensitive" } },
          ]
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        orderBy: [{ code: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.supplier.count({ where }),
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
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException("Supplier not found");
    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.findOne(id);
    try {
      return await this.prisma.supplier.update({
        where: { id },
        data: this.data(dto),
      });
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Supplier code already exists");
    }
  }

  async setActive(id: string, active: boolean) {
    await this.findOne(id);
    return this.prisma.supplier.update({ where: { id }, data: { active } });
  }

  private data(dto: CreateSupplierDto | UpdateSupplierDto) {
    return {
      code: dto.code?.trim().toUpperCase(),
      businessName: dto.businessName?.trim(),
      taxId: dto.taxId?.trim(),
      contactName: dto.contactName?.trim(),
      phone: dto.phone?.trim(),
      email: dto.email?.trim().toLowerCase(),
      address: dto.address?.trim(),
      notes: dto.notes?.trim(),
      active: dto.active,
    };
  }
}
