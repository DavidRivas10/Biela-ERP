import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { throwMappedPrismaError } from "../database/prisma-error.util";
import { CreateCustomerDto, UpdateCustomerDto } from "./dto/customer.dto";
import { ListCustomersQueryDto } from "./dto/list-customers-query.dto";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCustomerDto) {
    try {
      return await this.prisma.customer.create({
        data: {
          ...this.data(dto),
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
        },
      });
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Customer code already exists");
    }
  }

  async findAll(query: ListCustomersQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.CustomerWhereInput = {
      active: query.active,
      code: query.code
        ? { contains: query.code, mode: "insensitive" }
        : undefined,
      taxId: query.taxId
        ? { contains: query.taxId.trim(), mode: "insensitive" }
        : undefined,
      OR: search
        ? [
            { code: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
            { businessName: { contains: search, mode: "insensitive" } },
          ]
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: [{ code: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.customer.count({ where }),
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
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException("Customer not found");
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);
    try {
      return await this.prisma.customer.update({
        where: { id },
        data: this.data(dto),
      });
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Customer code already exists");
    }
  }

  async setActive(id: string, active: boolean) {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data: { active } });
  }

  private data(dto: CreateCustomerDto | UpdateCustomerDto) {
    return {
      code: dto.code?.trim().toUpperCase(),
      name: dto.name?.trim(),
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
