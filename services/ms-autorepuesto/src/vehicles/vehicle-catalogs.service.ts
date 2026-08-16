import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { throwMappedPrismaError } from "../database/prisma-error.util";
import {
  CreateVehicleBrandDto,
  CreateVehicleModelDto,
  UpdateVehicleBrandDto,
  UpdateVehicleModelDto,
} from "./dto/vehicle-catalog.dto";

@Injectable()
export class VehicleCatalogsService {
  constructor(private readonly prisma: PrismaService) {}

  async createBrand(dto: CreateVehicleBrandDto) {
    try {
      return await this.prisma.vehicleBrand.create({
        data: {
          ...dto,
          code: dto.code.trim().toLowerCase(),
          name: dto.name.trim(),
        },
      });
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Vehicle brand code already exists");
    }
  }

  listBrands() {
    return this.prisma.vehicleBrand.findMany({ orderBy: { name: "asc" } });
  }

  async updateBrand(id: string, dto: UpdateVehicleBrandDto) {
    const existing = await this.prisma.vehicleBrand.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Vehicle brand not found");
    try {
      return await this.prisma.vehicleBrand.update({
        where: { id },
        data: {
          ...dto,
          code: dto.code?.trim().toLowerCase(),
          name: dto.name?.trim(),
        },
      });
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Vehicle brand code already exists");
    }
  }

  async createModel(dto: CreateVehicleModelDto) {
    await this.requireBrand(dto.brandId, true);
    try {
      return await this.prisma.vehicleModel.create({
        data: {
          ...dto,
          code: dto.code.trim().toLowerCase(),
          name: dto.name.trim(),
        },
        include: { brand: true },
      });
    } catch (error: unknown) {
      throwMappedPrismaError(
        error,
        "Vehicle model code already exists for this brand",
      );
    }
  }

  listModels(brandId?: string) {
    return this.prisma.vehicleModel.findMany({
      where: brandId ? { brandId } : undefined,
      include: { brand: true },
      orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
    });
  }

  async updateModel(id: string, dto: UpdateVehicleModelDto) {
    const existing = await this.prisma.vehicleModel.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Vehicle model not found");
    if (dto.brandId) await this.requireBrand(dto.brandId, true);
    try {
      return await this.prisma.vehicleModel.update({
        where: { id },
        data: {
          ...dto,
          code: dto.code?.trim().toLowerCase(),
          name: dto.name?.trim(),
        },
        include: { brand: true },
      });
    } catch (error: unknown) {
      throwMappedPrismaError(
        error,
        "Vehicle model code already exists for this brand",
      );
    }
  }

  async requireBrand(id: string, activeOnly: boolean) {
    const brand = await this.prisma.vehicleBrand.findFirst({
      where: { id, ...(activeOnly ? { active: true } : {}) },
    });
    if (!brand)
      throw new BadRequestException("Vehicle brand is invalid or inactive");
    return brand;
  }

  async requireModel(id: string, activeOnly: boolean) {
    const model = await this.prisma.vehicleModel.findFirst({
      where: {
        id,
        ...(activeOnly ? { active: true, brand: { active: true } } : {}),
      },
      include: { brand: true },
    });
    if (!model)
      throw new BadRequestException("Vehicle model is invalid or inactive");
    return model;
  }
}
