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
import {
  CreateSaleItemDto,
  CreateSaleDto,
  UpdateSaleDto,
} from "./dto/sale.dto";
import { ListSalesQueryDto } from "./dto/list-sales-query.dto";
import { calculateSaleMoney, SaleMoneyInput } from "./sale-money";

const saleDetailInclude = {
  customer: true,
  items: {
    include: {
      product: true,
      sourceLocation: true,
      returnItems: {
        include: {
          saleReturn: { select: { id: true, number: true, status: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  },
  returns: {
    include: {
      items: { include: { destinationLocation: true } },
    },
    orderBy: { number: "asc" },
  },
} satisfies Prisma.SaleInclude;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async create(dto: CreateSaleDto, actorId: string) {
    this.ensureDistinctItems(dto.items);
    try {
      const sale = await this.prisma.runSerializable(async (transaction) => {
        if (dto.customerId)
          await this.requireActiveCustomer(transaction, dto.customerId);
        const resolved = await this.resolveActiveItems(transaction, dto.items);
        const money = calculateSaleMoney(resolved);
        return transaction.sale.create({
          data: {
            customerId: dto.customerId ?? null,
            documentDate: this.date(dto.documentDate),
            notes: dto.notes?.trim(),
            createdByActorId: actorId,
            subtotal: money.subtotal,
            discountTotal: money.discountTotal,
            taxTotal: money.taxTotal,
            total: money.total,
            items: { create: money.items },
          },
          include: saleDetailInclude,
        });
      });
      return this.detail(sale);
    } catch (error: unknown) {
      throwMappedPrismaError(
        error,
        "A Product and source Location pair may appear only once in a Sale",
      );
    }
  }

  async findAll(query: ListSalesQueryDto) {
    const from = query.from ? this.date(query.from) : undefined;
    const to = query.to ? this.date(query.to) : undefined;
    if (from && to && from > to)
      throw new BadRequestException("Sale document date range is invalid");
    const where: Prisma.SaleWhereInput = {
      number: query.number,
      customerId: query.customerId,
      status: query.status,
      documentDate: from || to ? { gte: from, lte: to } : undefined,
      items: query.productId
        ? { some: { productId: query.productId } }
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: {
          customer: true,
          _count: { select: { items: true, returns: true } },
        },
        orderBy: [{ documentDate: "desc" }, { number: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.sale.count({ where }),
    ]);
    return {
      data: data.map((sale) => this.moneyHeader(sale)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: saleDetailInclude,
    });
    if (!sale) throw new NotFoundException("Sale not found");
    const inventoryMovements = await this.prisma.inventoryMovement.findMany({
      where: {
        referenceType: InventoryMovementReferenceType.SALE,
        referenceId: id,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return { ...this.detail(sale), inventoryMovements };
  }

  async update(id: string, dto: UpdateSaleDto) {
    if (dto.items) this.ensureDistinctItems(dto.items);
    try {
      const sale = await this.prisma.runSerializable(async (transaction) => {
        await this.lockSale(transaction, id);
        const existing = await transaction.sale.findUnique({
          where: { id },
          include: { items: true },
        });
        if (!existing) throw new NotFoundException("Sale not found");
        if (existing.status !== SaleStatus.DRAFT)
          throw new ConflictException("Only DRAFT Sales are editable");
        const customerId =
          dto.customerId === undefined ? existing.customerId : dto.customerId;
        if (customerId)
          await this.requireActiveCustomer(transaction, customerId);
        const inputs: CreateSaleItemDto[] =
          dto.items ??
          existing.items.map((item) => ({
            productId: item.productId,
            sourceLocationId: item.sourceLocationId,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            discountAmount: item.discountAmount.toString(),
            taxAmount: item.taxAmount.toString(),
          }));
        const resolved = await this.resolveActiveItems(transaction, inputs);
        const money = calculateSaleMoney(resolved);
        return transaction.sale.update({
          where: { id },
          data: {
            customerId,
            documentDate: dto.documentDate
              ? this.date(dto.documentDate)
              : undefined,
            notes: dto.notes?.trim(),
            subtotal: money.subtotal,
            discountTotal: money.discountTotal,
            taxTotal: money.taxTotal,
            total: money.total,
            items: dto.items
              ? { deleteMany: {}, create: money.items }
              : undefined,
          },
          include: saleDetailInclude,
        });
      });
      return this.detail(sale);
    } catch (error: unknown) {
      throwMappedPrismaError(
        error,
        "A Product and source Location pair may appear only once in a Sale",
      );
    }
  }

  async post(id: string, actorId: string) {
    try {
      const sale = await this.prisma.runSerializable(async (transaction) => {
        await this.lockSale(transaction, id);
        const draft = await transaction.sale.findUnique({
          where: { id },
          include: saleDetailInclude,
        });
        if (!draft) throw new NotFoundException("Sale not found");
        if (draft.status !== SaleStatus.DRAFT)
          throw new ConflictException("Sale is not postable");
        if (draft.customerId)
          await this.requireActiveCustomer(transaction, draft.customerId);
        const resolved = await this.resolveActiveItems(
          transaction,
          draft.items.map((item) => ({
            productId: item.productId,
            sourceLocationId: item.sourceLocationId,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            discountAmount: item.discountAmount.toString(),
            taxAmount: item.taxAmount.toString(),
          })),
        );
        const money = calculateSaleMoney(resolved);
        const itemsByKey = new Map(
          draft.items.map((item) => [
            `${item.productId}:${item.sourceLocationId}`,
            item,
          ]),
        );
        for (const item of [...money.items].sort((left, right) =>
          `${left.productId}:${left.sourceLocationId}`.localeCompare(
            `${right.productId}:${right.sourceLocationId}`,
          ),
        )) {
          const saleItem = itemsByKey.get(
            `${item.productId}:${item.sourceLocationId}`,
          )!;
          await this.inventory.createMovementInTransaction(
            transaction,
            {
              type: InventoryMovementType.OUT,
              productId: item.productId,
              sourceLocationId: item.sourceLocationId,
              quantity: item.quantity,
              reason: `Sale #${draft.number}`,
            },
            actorId,
            {
              type: InventoryMovementReferenceType.SALE,
              documentId: draft.id,
              itemId: saleItem.id,
            },
          );
        }
        const posted = await transaction.sale.updateMany({
          where: { id, status: SaleStatus.DRAFT },
          data: {
            status: SaleStatus.POSTED,
            postedAt: new Date(),
            postedByActorId: actorId,
            subtotal: money.subtotal,
            discountTotal: money.discountTotal,
            taxTotal: money.taxTotal,
            total: money.total,
          },
        });
        if (posted.count !== 1)
          throw new ConflictException("Sale was already posted");
        return transaction.sale.findUniqueOrThrow({
          where: { id },
          include: saleDetailInclude,
        });
      });
      return this.detail(sale);
    } catch (error: unknown) {
      throwMappedPrismaError(
        error,
        "Sale was already posted or conflicts with Inventory",
      );
    }
  }

  async cancel(id: string, actorId: string) {
    return this.prisma.runSerializable(async (transaction) => {
      await this.lockSale(transaction, id);
      const sale = await transaction.sale.findUnique({ where: { id } });
      if (!sale) throw new NotFoundException("Sale not found");
      if (sale.status !== SaleStatus.DRAFT)
        throw new ConflictException("Only a DRAFT Sale may be cancelled");
      return transaction.sale.update({
        where: { id },
        data: {
          status: SaleStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledByActorId: actorId,
        },
        include: saleDetailInclude,
      });
    });
  }

  private async resolveActiveItems(
    transaction: Prisma.TransactionClient,
    items: CreateSaleItemDto[],
  ): Promise<SaleMoneyInput[]> {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const locationIds = [
      ...new Set(items.map((item) => item.sourceLocationId)),
    ];
    const [products, locations] = await Promise.all([
      transaction.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, active: true, defaultSalePrice: true },
      }),
      transaction.location.findMany({
        where: { id: { in: locationIds } },
        select: { id: true, active: true },
      }),
    ]);
    if (products.length !== productIds.length)
      throw new NotFoundException("Product not found");
    if (locations.length !== locationIds.length)
      throw new NotFoundException("Location not found");
    if (products.some((product) => !product.active))
      throw new ConflictException("Inactive Product cannot be sold");
    if (locations.some((location) => !location.active))
      throw new ConflictException("Inactive Location cannot supply a Sale");
    const productsById = new Map(
      products.map((product) => [product.id, product]),
    );
    return items.map((item) => {
      const unitPrice =
        item.unitPrice ?? productsById.get(item.productId)!.defaultSalePrice;
      if (unitPrice === null || unitPrice === undefined)
        throw new BadRequestException(
          "unitPrice is required when Product has no defaultSalePrice",
        );
      return { ...item, unitPrice };
    });
  }

  private async requireActiveCustomer(
    transaction: Prisma.TransactionClient,
    id: string,
  ) {
    const customer = await transaction.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException("Customer not found");
    if (!customer.active)
      throw new ConflictException("Inactive Customer cannot be assigned");
  }

  private ensureDistinctItems(items: CreateSaleItemDto[]) {
    const keys = items.map(
      (item) => `${item.productId}:${item.sourceLocationId}`,
    );
    if (new Set(keys).size !== keys.length)
      throw new BadRequestException(
        "A Product and source Location pair may appear only once in a Sale",
      );
  }

  private detail<
    T extends Prisma.SaleGetPayload<{ include: typeof saleDetailInclude }>,
  >(sale: T) {
    return {
      ...this.moneyHeader(sale),
      walkIn: sale.customerId === null,
      items: sale.items.map((item) => {
        const returnedQuantity = item.returnItems.reduce(
          (sum, returned) =>
            sum +
            (returned.saleReturn.status === SaleStatus.POSTED
              ? returned.quantityReturned
              : 0),
          0,
        );
        return {
          ...item,
          unitPrice: item.unitPrice.toFixed(4),
          discountAmount: item.discountAmount.toFixed(2),
          taxAmount: item.taxAmount.toFixed(2),
          lineSubtotal: item.lineSubtotal.toFixed(2),
          lineTotal: item.lineTotal.toFixed(2),
          returnedQuantity,
          netQuantity: item.quantity - returnedQuantity,
        };
      }),
    };
  }

  private moneyHeader<
    T extends {
      subtotal: Prisma.Decimal;
      discountTotal: Prisma.Decimal;
      taxTotal: Prisma.Decimal;
      total: Prisma.Decimal;
    },
  >(sale: T) {
    return {
      ...sale,
      subtotal: sale.subtotal.toFixed(2),
      discountTotal: sale.discountTotal.toFixed(2),
      taxTotal: sale.taxTotal.toFixed(2),
      total: sale.total.toFixed(2),
    };
  }

  private date(value: string) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private async lockSale(transaction: Prisma.TransactionClient, id: string) {
    await transaction.$queryRaw`
      SELECT "id" FROM "Sale" WHERE "id" = ${id}::uuid FOR UPDATE
    `;
  }
}
