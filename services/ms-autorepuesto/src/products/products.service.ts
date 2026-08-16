import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { throwMappedPrismaError } from "../database/prisma-error.util";
import {
  CreateProductDto,
  ProductAttributeInputDto,
  UpdateProductDto,
} from "./dto/product.dto";
import { ListProductsQueryDto } from "./dto/list-products-query.dto";
import { ProductCatalogsService } from "./product-catalogs.service";

const productInclude = {
  category: true,
  brand: true,
  attributes: {
    include: { definition: true },
    orderBy: { definition: { name: "asc" as const } },
  },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogs: ProductCatalogsService,
  ) {}

  async create(dto: CreateProductDto) {
    await Promise.all([
      this.catalogs.requireCategory(dto.categoryId, true),
      this.catalogs.requireBrand(dto.brandId, true),
    ]);
    const attributes = await this.validateAttributes(
      dto.categoryId,
      dto.attributes ?? [],
    );
    try {
      return await this.prisma.product.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          description: dto.description?.trim(),
          categoryId: dto.categoryId,
          brandId: dto.brandId,
          active: dto.active,
          attributes: attributes.length ? { create: attributes } : undefined,
        },
        include: productInclude,
      });
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Product code already exists");
    }
  }

  async findAll(query: ListProductsQueryDto) {
    const where: Prisma.ProductWhereInput = {
      active: query.active,
      categoryId: query.categoryId,
      brandId: query.brandId,
    };
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
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
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.findOne(id);
    const categoryId = dto.categoryId ?? existing.categoryId;
    if (dto.categoryId)
      await this.catalogs.requireCategory(dto.categoryId, true);
    if (dto.brandId) await this.catalogs.requireBrand(dto.brandId, true);

    const replacingAttributes =
      dto.attributes !== undefined || dto.categoryId !== undefined;
    const attributes = replacingAttributes
      ? await this.validateAttributes(categoryId, dto.attributes ?? [])
      : undefined;
    const data: Prisma.ProductUncheckedUpdateInput = {
      code: dto.code?.trim().toUpperCase(),
      name: dto.name?.trim(),
      description: dto.description?.trim(),
      categoryId: dto.categoryId,
      brandId: dto.brandId,
      active: dto.active,
    };

    try {
      if (attributes) {
        await this.prisma.$transaction(async (transaction) => {
          await transaction.product.update({ where: { id }, data });
          await transaction.productAttributeValue.deleteMany({
            where: { productId: id },
          });
          if (attributes.length) {
            await transaction.productAttributeValue.createMany({
              data: attributes.map((attribute) => ({
                ...attribute,
                productId: id,
              })),
            });
          }
        });
      } else {
        await this.prisma.product.update({ where: { id }, data });
      }
      return this.findOne(id);
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Product code already exists");
    }
  }

  async setActive(id: string, active: boolean) {
    await this.findOne(id);
    await this.prisma.product.update({ where: { id }, data: { active } });
    return this.findOne(id);
  }

  private async validateAttributes(
    categoryId: string,
    inputs: ProductAttributeInputDto[],
  ): Promise<Array<{ definitionId: string; value: string }>> {
    const definitions = await this.prisma.productAttributeDefinition.findMany({
      where: { categoryId, active: true },
    });
    const definitionsById = new Map(
      definitions.map((definition) => [definition.id, definition]),
    );
    if (
      new Set(inputs.map((input) => input.definitionId)).size !== inputs.length
    ) {
      throw new BadRequestException(
        "Product attributes cannot contain duplicate definitions",
      );
    }
    const missing = definitions.filter(
      (definition) =>
        definition.required &&
        !inputs.some((input) => input.definitionId === definition.id),
    );
    if (missing.length) {
      throw new BadRequestException(
        `Missing required product attributes: ${missing.map((definition) => definition.code).join(", ")}`,
      );
    }
    return inputs.map((input) => {
      const definition = definitionsById.get(input.definitionId);
      if (!definition) {
        throw new BadRequestException(
          "A product attribute is invalid, inactive, or belongs to another category",
        );
      }
      return {
        definitionId: definition.id,
        value: this.catalogs.validateAttributeValue(
          definition.valueType,
          input.value,
        ),
      };
    });
  }
}
