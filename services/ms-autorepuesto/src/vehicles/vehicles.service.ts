import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { CreateVehicleDto, UpdateVehicleDto } from "./dto/vehicle.dto";
import { ListVehiclesQueryDto } from "./dto/list-vehicles-query.dto";
import { VehicleCatalogsService } from "./vehicle-catalogs.service";

const vehicleInclude = {
  model: { include: { brand: true } },
} satisfies Prisma.VehicleInclude;

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogs: VehicleCatalogsService,
  ) {}

  async create(dto: CreateVehicleDto) {
    await this.catalogs.requireModel(dto.modelId, true);
    return this.prisma.vehicle.create({
      data: {
        modelId: dto.modelId,
        year: dto.year,
        engine: dto.engine.trim(),
        generation: dto.generation?.trim(),
        trim: dto.trim?.trim(),
        active: dto.active,
      },
      include: vehicleInclude,
    });
  }

  async findAll(query: ListVehiclesQueryDto) {
    const where: Prisma.VehicleWhereInput = {
      active: query.active,
      modelId: query.modelId,
      year: query.year,
      engine: query.engine
        ? { contains: query.engine.trim(), mode: "insensitive" }
        : undefined,
      model: query.brandId ? { brandId: query.brandId } : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        include: vehicleInclude,
        orderBy: [
          { model: { brand: { name: "asc" } } },
          { model: { name: "asc" } },
          { year: "desc" },
        ],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.vehicle.count({ where }),
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
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: vehicleInclude,
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    return vehicle;
  }

  async update(id: string, dto: UpdateVehicleDto) {
    await this.findOne(id);
    if (dto.modelId) await this.catalogs.requireModel(dto.modelId, true);
    const data: Prisma.VehicleUncheckedUpdateInput = {
      modelId: dto.modelId,
      year: dto.year,
      engine: dto.engine?.trim(),
      generation: dto.generation?.trim(),
      trim: dto.trim?.trim(),
      active: dto.active,
    };
    await this.prisma.vehicle.update({ where: { id }, data });
    return this.findOne(id);
  }

  async setActive(id: string, active: boolean) {
    await this.findOne(id);
    await this.prisma.vehicle.update({ where: { id }, data: { active } });
    return this.findOne(id);
  }
}
