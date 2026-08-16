import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ProductAttributeValueType } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { throwMappedPrismaError } from "../database/prisma-error.util";
import {
  CreateProductBrandDto,
  CreateProductCategoryDto,
  UpdateProductBrandDto,
  UpdateProductCategoryDto,
} from "./dto/catalog.dto";
import {
  CreateProductAttributeDefinitionDto,
  UpdateProductAttributeDefinitionDto,
} from "./dto/product-attribute-definition.dto";

@Injectable()
export class ProductCatalogsService {
  constructor(private readonly prisma: PrismaService) {}

  async createCategory(dto: CreateProductCategoryDto) {
    try {
      return await this.prisma.productCategory.create({
        data: {
          ...dto,
          code: dto.code.trim().toLowerCase(),
          name: dto.name.trim(),
          description: dto.description?.trim(),
        },
      });
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Product category code already exists");
    }
  }

  listCategories() {
    return this.prisma.productCategory.findMany({ orderBy: { name: "asc" } });
  }

  async updateCategory(id: string, dto: UpdateProductCategoryDto) {
    await this.requireCategory(id, false);
    try {
      return await this.prisma.productCategory.update({
        where: { id },
        data: {
          ...dto,
          code: dto.code?.trim().toLowerCase(),
          name: dto.name?.trim(),
          description: dto.description?.trim(),
        },
      });
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Product category code already exists");
    }
  }

  async createBrand(dto: CreateProductBrandDto) {
    try {
      return await this.prisma.productBrand.create({
        data: {
          ...dto,
          code: dto.code.trim().toLowerCase(),
          name: dto.name.trim(),
        },
      });
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Product brand code already exists");
    }
  }

  listBrands() {
    return this.prisma.productBrand.findMany({ orderBy: { name: "asc" } });
  }

  async updateBrand(id: string, dto: UpdateProductBrandDto) {
    await this.requireBrand(id, false);
    try {
      return await this.prisma.productBrand.update({
        where: { id },
        data: {
          ...dto,
          code: dto.code?.trim().toLowerCase(),
          name: dto.name?.trim(),
        },
      });
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Product brand code already exists");
    }
  }

  async createAttributeDefinition(dto: CreateProductAttributeDefinitionDto) {
    await this.requireCategory(dto.categoryId, true);
    try {
      return await this.prisma.productAttributeDefinition.create({
        data: {
          ...dto,
          code: dto.code.trim().toLowerCase(),
          name: dto.name.trim(),
          unit: dto.unit?.trim(),
        },
        include: { category: true },
      });
    } catch (error: unknown) {
      throwMappedPrismaError(
        error,
        "Attribute code already exists in this product category",
      );
    }
  }

  listAttributeDefinitions(categoryId?: string) {
    return this.prisma.productAttributeDefinition.findMany({
      where: categoryId ? { categoryId } : undefined,
      include: { category: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    });
  }

  async updateAttributeDefinition(
    id: string,
    dto: UpdateProductAttributeDefinitionDto,
  ) {
    const existing = await this.prisma.productAttributeDefinition.findUnique({
      where: { id },
      include: { _count: { select: { values: true } } },
    });
    if (!existing)
      throw new NotFoundException("Product attribute definition not found");
    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      if (existing._count.values > 0) {
        throw new BadRequestException(
          "An attribute definition already used by products cannot change category",
        );
      }
      await this.requireCategory(dto.categoryId, true);
    }
    if (
      dto.valueType &&
      dto.valueType !== existing.valueType &&
      existing._count.values > 0
    ) {
      throw new BadRequestException(
        "An attribute definition already used by products cannot change value type",
      );
    }
    try {
      return await this.prisma.productAttributeDefinition.update({
        where: { id },
        data: {
          ...dto,
          code: dto.code?.trim().toLowerCase(),
          name: dto.name?.trim(),
          unit: dto.unit?.trim(),
        },
        include: { category: true },
      });
    } catch (error: unknown) {
      throwMappedPrismaError(
        error,
        "Attribute code already exists in this product category",
      );
    }
  }

  async requireCategory(id: string, activeOnly: boolean) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id, ...(activeOnly ? { active: true } : {}) },
    });
    if (!category) {
      throw new BadRequestException("Product category is invalid or inactive");
    }
    return category;
  }

  async requireBrand(id: string, activeOnly: boolean) {
    const brand = await this.prisma.productBrand.findFirst({
      where: { id, ...(activeOnly ? { active: true } : {}) },
    });
    if (!brand)
      throw new BadRequestException("Product brand is invalid or inactive");
    return brand;
  }

  validateAttributeValue(
    type: ProductAttributeValueType,
    value: string,
  ): string {
    const normalized = value.trim();
    if (!normalized)
      throw new BadRequestException("Product attribute value is required");
    if (
      type === ProductAttributeValueType.NUMBER &&
      !Number.isFinite(Number(normalized))
    ) {
      throw new BadRequestException(
        `Attribute value '${value}' must be numeric`,
      );
    }
    if (type === ProductAttributeValueType.BOOLEAN) {
      const booleanValue = normalized.toLowerCase();
      if (booleanValue !== "true" && booleanValue !== "false") {
        throw new BadRequestException(
          `Attribute value '${value}' must be true or false`,
        );
      }
      return booleanValue;
    }
    return normalized;
  }
}
