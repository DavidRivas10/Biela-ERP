import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InventoryMovementType, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { throwMappedPrismaError } from "../database/prisma-error.util";
import { CreateInventoryMovementDto } from "./dto/inventory-movement.dto";
import { ListInventoryMovementsQueryDto } from "./dto/list-inventory-movements-query.dto";
import { ListInventoryQueryDto } from "./dto/list-inventory-query.dto";

const inventoryInclude = {
  product: { include: { category: true, brand: true } },
  location: true,
} satisfies Prisma.InventoryInclude;

const movementInclude = {
  product: { select: { id: true, code: true, name: true, active: true } },
  sourceLocation: true,
  destinationLocation: true,
} satisfies Prisma.InventoryMovementInclude;

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListInventoryQueryDto) {
    const where: Prisma.InventoryWhereInput = {
      productId: query.productId,
      locationId: query.locationId,
      quantity:
        query.inStock === undefined
          ? undefined
          : query.inStock
            ? { gt: 0 }
            : { equals: 0 },
    };
    const [data, total] = await Promise.all([
      this.prisma.inventory.findMany({
        where,
        include: inventoryInclude,
        orderBy: [
          { product: { code: "asc" } },
          { location: { code: "asc" } },
          { id: "asc" },
        ],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.inventory.count({ where }),
    ]);
    return { data, meta: this.meta(query.page, query.limit, total) };
  }

  async findOne(id: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { id },
      include: inventoryInclude,
    });
    if (!inventory) throw new NotFoundException("Inventory record not found");
    return inventory;
  }

  async findByProduct(productId: string, query: ListInventoryQueryDto) {
    await this.requireProduct(this.prisma, productId, false);
    const scoped = { ...query, productId };
    const result = await this.findAll(scoped);
    const aggregate = await this.prisma.inventory.aggregate({
      where: { productId },
      _sum: { quantity: true },
    });
    return { ...result, totalQuantity: aggregate._sum.quantity ?? 0 };
  }

  async findByLocation(locationId: string, query: ListInventoryQueryDto) {
    await this.requireLocation(this.prisma, locationId, false);
    return this.findAll({ ...query, locationId });
  }

  async createMovement(dto: CreateInventoryMovementDto, actorId: string) {
    this.validateMovementShape(dto);
    try {
      return await this.runSerializable((transaction) =>
        this.applyMovement(transaction, dto, actorId),
      );
    } catch (error: unknown) {
      throwMappedPrismaError(
        error,
        dto.type === InventoryMovementType.INITIAL
          ? "Inventory has already been initialized for this product and location"
          : "Inventory state conflicts with another operation",
      );
    }
  }

  async findMovements(query: ListInventoryMovementsQueryDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from > to)
      throw new BadRequestException("Movement date range is invalid");
    const where: Prisma.InventoryMovementWhereInput = {
      productId: query.productId,
      type: query.type,
      createdAt: from || to ? { gte: from, lte: to } : undefined,
      OR: query.locationId
        ? [
            { sourceLocationId: query.locationId },
            { destinationLocationId: query.locationId },
          ]
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        include: movementInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);
    return { data, meta: this.meta(query.page, query.limit, total) };
  }

  private async applyMovement(
    transaction: Prisma.TransactionClient,
    dto: CreateInventoryMovementDto,
    actorId: string,
  ) {
    await this.requireProduct(transaction, dto.productId, true);
    if (dto.sourceLocationId)
      await this.requireLocation(transaction, dto.sourceLocationId, true);
    if (dto.destinationLocationId)
      await this.requireLocation(transaction, dto.destinationLocationId, true);

    switch (dto.type) {
      case InventoryMovementType.INITIAL:
        return this.applyInitial(transaction, dto, actorId);
      case InventoryMovementType.IN:
        return this.applyIn(transaction, dto, actorId);
      case InventoryMovementType.OUT:
        return this.applyOut(transaction, dto, actorId);
      case InventoryMovementType.ADJUSTMENT:
        return this.applyAdjustment(transaction, dto, actorId);
      case InventoryMovementType.TRANSFER:
        return this.applyTransfer(transaction, dto, actorId);
    }
  }

  private async applyInitial(
    transaction: Prisma.TransactionClient,
    dto: CreateInventoryMovementDto,
    actorId: string,
  ) {
    await transaction.inventory.create({
      data: {
        productId: dto.productId,
        locationId: dto.destinationLocationId!,
        quantity: dto.quantity,
      },
    });
    return this.recordMovement(transaction, dto, actorId, {
      destinationQuantityBefore: 0,
      destinationQuantityAfter: dto.quantity,
    });
  }

  private async applyIn(
    transaction: Prisma.TransactionClient,
    dto: CreateInventoryMovementDto,
    actorId: string,
  ) {
    const before = await this.quantityAt(
      transaction,
      dto.productId,
      dto.destinationLocationId!,
    );
    await transaction.inventory.upsert({
      where: {
        productId_locationId: {
          productId: dto.productId,
          locationId: dto.destinationLocationId!,
        },
      },
      create: {
        productId: dto.productId,
        locationId: dto.destinationLocationId!,
        quantity: dto.quantity,
      },
      update: { quantity: { increment: dto.quantity } },
    });
    return this.recordMovement(transaction, dto, actorId, {
      destinationQuantityBefore: before,
      destinationQuantityAfter: before + dto.quantity,
    });
  }

  private async applyOut(
    transaction: Prisma.TransactionClient,
    dto: CreateInventoryMovementDto,
    actorId: string,
  ) {
    const inventory = await transaction.inventory.findUnique({
      where: {
        productId_locationId: {
          productId: dto.productId,
          locationId: dto.sourceLocationId!,
        },
      },
    });
    if (!inventory) throw new ConflictException("Insufficient stock");
    const result = await transaction.inventory.updateMany({
      where: { id: inventory.id, quantity: { gte: dto.quantity } },
      data: { quantity: { decrement: dto.quantity } },
    });
    if (result.count !== 1) throw new ConflictException("Insufficient stock");
    return this.recordMovement(transaction, dto, actorId, {
      sourceQuantityBefore: inventory.quantity,
      sourceQuantityAfter: inventory.quantity - dto.quantity,
    });
  }

  private async applyAdjustment(
    transaction: Prisma.TransactionClient,
    dto: CreateInventoryMovementDto,
    actorId: string,
  ) {
    const inventory = await transaction.inventory.findUnique({
      where: {
        productId_locationId: {
          productId: dto.productId,
          locationId: dto.destinationLocationId!,
        },
      },
    });
    if (!inventory)
      throw new NotFoundException(
        "Inventory must be initialized before adjustment",
      );
    await transaction.inventory.update({
      where: { id: inventory.id },
      data: { quantity: dto.quantity },
    });
    return this.recordMovement(transaction, dto, actorId, {
      destinationQuantityBefore: inventory.quantity,
      destinationQuantityAfter: dto.quantity,
    });
  }

  private async applyTransfer(
    transaction: Prisma.TransactionClient,
    dto: CreateInventoryMovementDto,
    actorId: string,
  ) {
    const source = await transaction.inventory.findUnique({
      where: {
        productId_locationId: {
          productId: dto.productId,
          locationId: dto.sourceLocationId!,
        },
      },
    });
    if (!source) throw new ConflictException("Insufficient source stock");
    const destinationBefore = await this.quantityAt(
      transaction,
      dto.productId,
      dto.destinationLocationId!,
    );
    const decrease = await transaction.inventory.updateMany({
      where: { id: source.id, quantity: { gte: dto.quantity } },
      data: { quantity: { decrement: dto.quantity } },
    });
    if (decrease.count !== 1)
      throw new ConflictException("Insufficient source stock");
    await transaction.inventory.upsert({
      where: {
        productId_locationId: {
          productId: dto.productId,
          locationId: dto.destinationLocationId!,
        },
      },
      create: {
        productId: dto.productId,
        locationId: dto.destinationLocationId!,
        quantity: dto.quantity,
      },
      update: { quantity: { increment: dto.quantity } },
    });
    return this.recordMovement(transaction, dto, actorId, {
      sourceQuantityBefore: source.quantity,
      sourceQuantityAfter: source.quantity - dto.quantity,
      destinationQuantityBefore: destinationBefore,
      destinationQuantityAfter: destinationBefore + dto.quantity,
    });
  }

  private recordMovement(
    transaction: Prisma.TransactionClient,
    dto: CreateInventoryMovementDto,
    actorId: string,
    balances: {
      sourceQuantityBefore?: number;
      sourceQuantityAfter?: number;
      destinationQuantityBefore?: number;
      destinationQuantityAfter?: number;
    },
  ) {
    return transaction.inventoryMovement.create({
      data: {
        productId: dto.productId,
        sourceLocationId: dto.sourceLocationId,
        destinationLocationId: dto.destinationLocationId,
        type: dto.type,
        quantity: dto.quantity,
        reason: dto.reason?.trim(),
        actorId,
        ...balances,
      },
      include: movementInclude,
    });
  }

  private validateMovementShape(dto: CreateInventoryMovementDto): void {
    const source = Boolean(dto.sourceLocationId);
    const destination = Boolean(dto.destinationLocationId);
    if (dto.type !== InventoryMovementType.ADJUSTMENT && dto.quantity <= 0)
      throw new BadRequestException(
        "Movement quantity must be greater than zero",
      );
    if (dto.type === InventoryMovementType.ADJUSTMENT && !dto.reason?.trim())
      throw new BadRequestException("Adjustment reason is required");
    const destinationOnly =
      dto.type === InventoryMovementType.INITIAL ||
      dto.type === InventoryMovementType.IN ||
      dto.type === InventoryMovementType.ADJUSTMENT;
    if (destinationOnly && (source || !destination))
      throw new BadRequestException(
        `${dto.type} requires only a destination location`,
      );
    if (dto.type === InventoryMovementType.OUT && (!source || destination))
      throw new BadRequestException("OUT requires only a source location");
    if (dto.type === InventoryMovementType.TRANSFER) {
      if (!source || !destination)
        throw new BadRequestException(
          "TRANSFER requires source and destination locations",
        );
      if (dto.sourceLocationId === dto.destinationLocationId)
        throw new BadRequestException(
          "TRANSFER source and destination must differ",
        );
    }
  }

  private async quantityAt(
    transaction: Prisma.TransactionClient,
    productId: string,
    locationId: string,
  ): Promise<number> {
    const inventory = await transaction.inventory.findUnique({
      where: { productId_locationId: { productId, locationId } },
      select: { quantity: true },
    });
    return inventory?.quantity ?? 0;
  }

  private async requireProduct(
    client: Prisma.TransactionClient | PrismaService,
    id: string,
    activeOnly: boolean,
  ) {
    const product = await client.product.findFirst({
      where: { id, active: activeOnly ? true : undefined },
      select: { id: true },
    });
    if (!product) throw new NotFoundException("Product not found or inactive");
    return product;
  }

  private async requireLocation(
    client: Prisma.TransactionClient | PrismaService,
    id: string,
    activeOnly: boolean,
  ) {
    const location = await client.location.findFirst({
      where: { id, active: activeOnly ? true : undefined },
      select: { id: true },
    });
    if (!location)
      throw new NotFoundException("Location not found or inactive");
    return location;
  }

  private async runSerializable<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error: unknown) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034";
        if (!retryable) throw error;
        if (attempt === 3)
          throw new ConflictException(
            "Inventory changed concurrently; retry the operation",
          );
      }
    }
    throw new ConflictException("Inventory operation could not be serialized");
  }

  private meta(page: number, limit: number, total: number) {
    return { page, limit, total, pages: Math.ceil(total / limit) };
  }
}
