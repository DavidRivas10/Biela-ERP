import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { throwMappedPrismaError } from "../database/prisma-error.util";
import {
  CreateCompatibilityDto,
  UpdateCompatibilityDto,
} from "./dto/compatibility.dto";
import {
  ListCompatibilitiesQueryDto,
  NestedCompatibilityQueryDto,
} from "./dto/list-compatibilities-query.dto";

const compatibilityInclude = {
  product: { include: { category: true, brand: true } },
  vehicle: { include: { model: { include: { brand: true } } } },
} satisfies Prisma.ProductCompatibilityInclude;

@Injectable()
export class CompatibilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCompatibilityDto) {
    await Promise.all([
      this.requireProduct(dto.productId, true),
      this.requireVehicle(dto.vehicleId, true),
    ]);
    try {
      return await this.prisma.productCompatibility.create({
        data: { ...dto, notes: dto.notes?.trim() },
        include: compatibilityInclude,
      });
    } catch (error: unknown) {
      throwMappedPrismaError(
        error,
        "This product and vehicle are already linked",
      );
    }
  }

  async findAll(query: ListCompatibilitiesQueryDto) {
    const where: Prisma.ProductCompatibilityWhereInput = {
      productId: query.productId,
      vehicleId: query.vehicleId,
      active: query.active,
    };
    const [data, total] = await Promise.all([
      this.prisma.productCompatibility.findMany({
        where,
        include: compatibilityInclude,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.productCompatibility.count({ where }),
    ]);
    return { data, meta: this.meta(query.page, query.limit, total) };
  }

  async findOne(id: string) {
    const compatibility = await this.prisma.productCompatibility.findUnique({
      where: { id },
      include: compatibilityInclude,
    });
    if (!compatibility) throw new NotFoundException("Compatibility not found");
    return compatibility;
  }

  async update(id: string, dto: UpdateCompatibilityDto) {
    await this.findOne(id);
    await this.prisma.productCompatibility.update({
      where: { id },
      data: { ...dto, notes: dto.notes?.trim() },
    });
    return this.findOne(id);
  }

  async compatibleVehicles(
    productId: string,
    query: NestedCompatibilityQueryDto,
  ) {
    await this.requireProduct(productId, false);
    const where: Prisma.ProductCompatibilityWhereInput = {
      productId,
      active: query.active,
    };
    const [links, total] = await Promise.all([
      this.prisma.productCompatibility.findMany({
        where,
        include: {
          vehicle: { include: { model: { include: { brand: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.productCompatibility.count({ where }),
    ]);
    return {
      data: links.map((link) => ({
        ...link.vehicle,
        compatibility: { id: link.id, notes: link.notes, active: link.active },
      })),
      meta: this.meta(query.page, query.limit, total),
    };
  }

  async compatibleProducts(
    vehicleId: string,
    query: NestedCompatibilityQueryDto,
  ) {
    await this.requireVehicle(vehicleId, false);
    const where: Prisma.ProductCompatibilityWhereInput = {
      vehicleId,
      active: query.active,
    };
    const [links, total] = await Promise.all([
      this.prisma.productCompatibility.findMany({
        where,
        include: { product: { include: { category: true, brand: true } } },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.productCompatibility.count({ where }),
    ]);
    return {
      data: links.map((link) => ({
        ...link.product,
        compatibility: { id: link.id, notes: link.notes, active: link.active },
      })),
      meta: this.meta(query.page, query.limit, total),
    };
  }

  private async requireProduct(id: string, activeOnly: boolean) {
    const product = await this.prisma.product.findFirst({
      where: { id, ...(activeOnly ? { active: true } : {}) },
    });
    if (!product) throw new NotFoundException("Product not found or inactive");
    return product;
  }

  private async requireVehicle(id: string, activeOnly: boolean) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, ...(activeOnly ? { active: true } : {}) },
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found or inactive");
    return vehicle;
  }

  private meta(page: number, limit: number, total: number) {
    return { page, limit, total, pages: Math.ceil(total / limit) };
  }
}
