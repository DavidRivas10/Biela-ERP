import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { throwMappedPrismaError } from "../database/prisma-error.util";
import { ListLocationsQueryDto } from "./dto/list-locations-query.dto";
import { CreateLocationDto, UpdateLocationDto } from "./dto/location.dto";

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLocationDto) {
    try {
      return await this.prisma.location.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          description: dto.description?.trim(),
          zone: dto.zone?.trim(),
          aisle: dto.aisle?.trim(),
          rack: dto.rack?.trim(),
          shelf: dto.shelf?.trim(),
          bin: dto.bin?.trim(),
          active: dto.active,
        },
      });
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Location code already exists");
    }
  }

  async findAll(query: ListLocationsQueryDto) {
    const where: Prisma.LocationWhereInput = {
      active: query.active,
      code: query.code
        ? { contains: query.code, mode: "insensitive" }
        : undefined,
    };
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { zone: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.location.findMany({
        where,
        orderBy: [{ code: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.location.count({ where }),
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
    const location = await this.prisma.location.findUnique({ where: { id } });
    if (!location) throw new NotFoundException("Location not found");
    return location;
  }

  async update(id: string, dto: UpdateLocationDto) {
    await this.findOne(id);
    try {
      return await this.prisma.location.update({
        where: { id },
        data: this.data(dto),
      });
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Location code already exists");
    }
  }

  async setActive(id: string, active: boolean) {
    await this.findOne(id);
    return this.prisma.location.update({ where: { id }, data: { active } });
  }

  async requireActive(id: string) {
    const location = await this.prisma.location.findUnique({ where: { id } });
    if (!location) throw new NotFoundException("Location not found");
    if (!location.active)
      throw new NotFoundException("Active location not found");
    return location;
  }

  private data(dto: CreateLocationDto | UpdateLocationDto) {
    return {
      code: dto.code?.trim().toUpperCase(),
      name: dto.name?.trim(),
      description: dto.description?.trim(),
      zone: dto.zone?.trim(),
      aisle: dto.aisle?.trim(),
      rack: dto.rack?.trim(),
      shelf: dto.shelf?.trim(),
      bin: dto.bin?.trim(),
      active: dto.active,
    };
  }
}
