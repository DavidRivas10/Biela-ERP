import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { SearchProductsQueryDto } from "./dto/search-products-query.dto";

@Injectable()
export class ProductSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: SearchProductsQueryDto) {
    const text = query.q?.trim();
    const vehicleWhere = this.vehicleWhere(query);
    const where: Prisma.ProductWhereInput = {
      active: query.active,
      categoryId: query.categoryId,
      brandId: query.brandId,
      inventories:
        query.inStock === undefined
          ? undefined
          : query.inStock
            ? { some: { quantity: { gt: 0 } } }
            : { none: { quantity: { gt: 0 } } },
      compatibilities: vehicleWhere
        ? {
            some: {
              active: true,
              vehicle: { is: vehicleWhere },
            },
          }
        : undefined,
      OR: text
        ? [
            { code: { contains: text, mode: "insensitive" } },
            { name: { contains: text, mode: "insensitive" } },
          ]
        : undefined,
    };

    const exact = text
      ? await this.prisma.product.findFirst({
          where: {
            AND: [where, { code: { equals: text.toUpperCase() } }],
          },
          select: { id: true },
        })
      : null;
    const total = await this.prisma.product.count({ where });
    const offset = (query.page - 1) * query.limit;
    const ids: string[] = [];
    let partialSkip = offset;
    let partialTake = query.limit;
    if (exact) {
      if (offset === 0) {
        ids.push(exact.id);
        partialTake -= 1;
      } else {
        partialSkip -= 1;
      }
    }
    if (partialTake > 0) {
      const partial = await this.prisma.product.findMany({
        where: exact ? { AND: [where, { id: { not: exact.id } }] } : where,
        select: { id: true },
        orderBy: [{ code: "asc" }, { id: "asc" }],
        skip: Math.max(0, partialSkip),
        take: partialTake,
      });
      ids.push(...partial.map((product) => product.id));
    }

    const products = ids.length
      ? await this.prisma.product.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            active: true,
            createdAt: true,
            updatedAt: true,
            category: true,
            brand: true,
            attributes: {
              include: { definition: true },
              orderBy: { definition: { name: "asc" } },
            },
            inventories: {
              where: { quantity: { gt: 0 } },
              select: { quantity: true, location: true },
              orderBy: { location: { code: "asc" } },
            },
            compatibilities: {
              where: vehicleWhere
                ? { active: true, vehicle: { is: vehicleWhere } }
                : { id: { in: [] } },
              select: {
                id: true,
                notes: true,
                vehicle: {
                  include: { model: { include: { brand: true } } },
                },
              },
              orderBy: { id: "asc" },
            },
          },
        })
      : [];
    const byId = new Map(products.map((product) => [product.id, product]));
    const data = ids
      .map((id) => byId.get(id)!)
      .map((product) => {
        const { compatibilities, ...rest } = product;
        return {
          ...rest,
          totalStock: product.inventories.reduce(
            (totalQuantity, inventory) => totalQuantity + inventory.quantity,
            0,
          ),
          matchingVehicles: compatibilities.map((compatibility) => ({
            compatibilityId: compatibility.id,
            notes: compatibility.notes,
            ...compatibility.vehicle,
          })),
        };
      });
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

  private vehicleWhere(
    query: SearchProductsQueryDto,
  ): Prisma.VehicleWhereInput | undefined {
    const hasFilter =
      query.vehicleId !== undefined ||
      query.vehicleBrandId !== undefined ||
      query.vehicleModelId !== undefined ||
      query.year !== undefined ||
      query.engine !== undefined ||
      query.generation !== undefined ||
      query.trim !== undefined;
    if (!hasFilter) return undefined;
    return {
      id: query.vehicleId,
      active: true,
      modelId: query.vehicleModelId,
      year: query.year,
      engine: query.engine
        ? { contains: query.engine.trim(), mode: "insensitive" }
        : undefined,
      generation: query.generation
        ? { contains: query.generation.trim(), mode: "insensitive" }
        : undefined,
      trim: query.trim
        ? { contains: query.trim.trim(), mode: "insensitive" }
        : undefined,
      model: query.vehicleBrandId
        ? { is: { brandId: query.vehicleBrandId } }
        : undefined,
    };
  }
}
