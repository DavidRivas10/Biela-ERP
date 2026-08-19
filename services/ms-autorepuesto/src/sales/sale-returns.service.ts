import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  InventoryMovementReferenceType,
  InventoryMovementType,
  Prisma,
  SaleStatus,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { throwMappedPrismaError } from "../database/prisma-error.util";
import { InventoryService } from "../inventory/inventory.service";
import { ListSaleReturnsQueryDto } from "./dto/list-sale-returns-query.dto";
import {
  CreateSaleReturnDto,
  CreateSaleReturnItemDto,
} from "./dto/sale-return.dto";

const returnInclude = {
  sale: {
    select: { id: true, number: true, status: true, customerId: true },
  },
  items: {
    include: {
      saleItem: { include: { product: true, sourceLocation: true } },
      destinationLocation: true,
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.SaleReturnInclude;

@Injectable()
export class SaleReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async create(saleId: string, dto: CreateSaleReturnDto, actorId: string) {
    this.ensureDistinctItems(dto.items);
    try {
      return await this.prisma.runSerializable(async (transaction) => {
        await this.lockSale(transaction, saleId);
        await this.requirePostedSale(transaction, saleId);
        const saleItems = await this.requireOwnedItems(
          transaction,
          saleId,
          dto.items.map((item) => item.saleItemId),
        );
        await this.requireActiveLocations(
          transaction,
          dto.items.map((item) => item.destinationLocationId),
        );
        const eligibility = await this.returnEligibility(
          transaction,
          saleItems.map((item) => item.id),
        );
        this.validateEligibility(dto.items, eligibility);
        return transaction.saleReturn.create({
          data: {
            saleId,
            reason: dto.reason.trim(),
            createdByActorId: actorId,
            items: { create: dto.items },
          },
          include: returnInclude,
        });
      });
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Sale Return contains duplicate items");
    }
  }

  async findAll(saleId: string, query: ListSaleReturnsQueryDto) {
    await this.requireSale(this.prisma, saleId);
    const where: Prisma.SaleReturnWhereInput = {
      saleId,
      status: query.status,
    };
    const [data, total] = await Promise.all([
      this.prisma.saleReturn.findMany({
        where,
        include: returnInclude,
        orderBy: [{ number: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.saleReturn.count({ where }),
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
    const saleReturn = await this.prisma.saleReturn.findUnique({
      where: { id },
      include: returnInclude,
    });
    if (!saleReturn) throw new NotFoundException("Sale Return not found");
    const inventoryMovements = await this.prisma.inventoryMovement.findMany({
      where: {
        referenceType: InventoryMovementReferenceType.SALE_RETURN,
        referenceId: id,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return { ...saleReturn, inventoryMovements };
  }

  async post(id: string, actorId: string) {
    try {
      return await this.prisma.runSerializable(async (transaction) => {
        const identity = await transaction.saleReturn.findUnique({
          where: { id },
          select: { saleId: true },
        });
        if (!identity) throw new NotFoundException("Sale Return not found");
        await this.lockSale(transaction, identity.saleId);
        await this.lockReturn(transaction, id);
        const saleReturn = await transaction.saleReturn.findUnique({
          where: { id },
          include: returnInclude,
        });
        if (!saleReturn) throw new NotFoundException("Sale Return not found");
        if (saleReturn.status !== SaleStatus.DRAFT)
          throw new ConflictException("Sale Return is not postable");
        if (saleReturn.sale.status !== SaleStatus.POSTED)
          throw new ConflictException("Only a POSTED Sale can be returned");
        const saleItems = await this.requireOwnedItems(
          transaction,
          saleReturn.saleId,
          saleReturn.items.map((item) => item.saleItemId),
        );
        await this.requireActiveLocations(
          transaction,
          saleReturn.items.map((item) => item.destinationLocationId),
        );
        const eligibility = await this.returnEligibility(
          transaction,
          saleItems.map((item) => item.id),
        );
        this.validateEligibility(saleReturn.items, eligibility);

        for (const item of [...saleReturn.items].sort((left, right) =>
          `${left.saleItemId}:${left.destinationLocationId}`.localeCompare(
            `${right.saleItemId}:${right.destinationLocationId}`,
          ),
        )) {
          await this.inventory.createMovementInTransaction(
            transaction,
            {
              type: InventoryMovementType.IN,
              productId: item.saleItem.productId,
              destinationLocationId: item.destinationLocationId,
              quantity: item.quantityReturned,
              reason: `Sale Return #${saleReturn.number}`,
            },
            actorId,
            {
              type: InventoryMovementReferenceType.SALE_RETURN,
              documentId: saleReturn.id,
              itemId: item.id,
            },
          );
        }
        const posted = await transaction.saleReturn.updateMany({
          where: { id, status: SaleStatus.DRAFT },
          data: {
            status: SaleStatus.POSTED,
            postedAt: new Date(),
            postedByActorId: actorId,
          },
        });
        if (posted.count !== 1)
          throw new ConflictException("Sale Return was already posted");
        return transaction.saleReturn.findUniqueOrThrow({
          where: { id },
          include: returnInclude,
        });
      });
    } catch (error: unknown) {
      throwMappedPrismaError(
        error,
        "Sale Return was already posted or conflicts with return history",
      );
    }
  }

  private async returnEligibility(
    transaction: Prisma.TransactionClient,
    saleItemIds: string[],
  ) {
    const [sold, returned] = await Promise.all([
      transaction.saleItem.findMany({
        where: { id: { in: saleItemIds } },
        select: { id: true, quantity: true },
      }),
      transaction.saleReturnItem.groupBy({
        by: ["saleItemId"],
        where: {
          saleItemId: { in: saleItemIds },
          saleReturn: { status: SaleStatus.POSTED },
        },
        _sum: { quantityReturned: true },
      }),
    ]);
    const returnedByItem = new Map(
      returned.map((item) => [
        item.saleItemId,
        item._sum.quantityReturned ?? 0,
      ]),
    );
    return new Map(
      sold.map((item) => [
        item.id,
        item.quantity - (returnedByItem.get(item.id) ?? 0),
      ]),
    );
  }

  private validateEligibility(
    items: Array<{ saleItemId: string; quantityReturned: number }>,
    eligibility: Map<string, number>,
  ) {
    const requested = new Map<string, number>();
    for (const item of items)
      requested.set(
        item.saleItemId,
        (requested.get(item.saleItemId) ?? 0) + item.quantityReturned,
      );
    for (const [itemId, quantity] of requested)
      if (quantity > (eligibility.get(itemId) ?? 0))
        throw new ConflictException(
          "Sale Return exceeds sold quantity available for return",
        );
  }

  private async requireOwnedItems(
    transaction: Prisma.TransactionClient,
    saleId: string,
    ids: string[],
  ) {
    const uniqueIds = [...new Set(ids)];
    const items = await transaction.saleItem.findMany({
      where: { id: { in: uniqueIds }, saleId },
      select: { id: true, productId: true },
    });
    if (items.length !== uniqueIds.length)
      throw new BadRequestException(
        "Every Return item must belong to the referenced Sale",
      );
    return items;
  }

  private async requireActiveLocations(
    transaction: Prisma.TransactionClient,
    ids: string[],
  ) {
    const uniqueIds = [...new Set(ids)];
    const locations = await transaction.location.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, active: true },
    });
    if (locations.length !== uniqueIds.length)
      throw new NotFoundException("Location not found");
    if (locations.some((location) => !location.active))
      throw new ConflictException(
        "Inactive Location cannot receive returned stock",
      );
  }

  private async requirePostedSale(
    transaction: Prisma.TransactionClient,
    id: string,
  ) {
    const sale = await this.requireSale(transaction, id);
    if (sale.status !== SaleStatus.POSTED)
      throw new ConflictException("Only a POSTED Sale can be returned");
    return sale;
  }

  private async requireSale(
    client: Prisma.TransactionClient | PrismaService,
    id: string,
  ) {
    const sale = await client.sale.findUnique({ where: { id } });
    if (!sale) throw new NotFoundException("Sale not found");
    return sale;
  }

  private ensureDistinctItems(items: CreateSaleReturnItemDto[]) {
    const keys = items.map(
      (item) => `${item.saleItemId}:${item.destinationLocationId}`,
    );
    if (new Set(keys).size !== keys.length)
      throw new BadRequestException(
        "A Sale item and destination Location pair may appear only once in a Return",
      );
  }

  private async lockSale(transaction: Prisma.TransactionClient, id: string) {
    await transaction.$queryRaw`
      SELECT "id" FROM "Sale" WHERE "id" = ${id}::uuid FOR UPDATE
    `;
  }

  private async lockReturn(transaction: Prisma.TransactionClient, id: string) {
    await transaction.$queryRaw`
      SELECT "id" FROM "SaleReturn" WHERE "id" = ${id}::uuid FOR UPDATE
    `;
  }
}
