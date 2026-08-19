import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  PurchaseStatus,
  PurchasingDocumentStatus,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { throwMappedPrismaError } from "../database/prisma-error.util";
import { ListPurchasesQueryDto } from "./dto/list-purchases-query.dto";
import {
  CreatePurchaseDto,
  CreatePurchaseItemDto,
  UpdatePurchaseDto,
} from "./dto/purchase.dto";
import { calculatePurchaseMoney } from "./purchase-money";

const purchaseDetailInclude = {
  supplier: true,
  items: { include: { product: true }, orderBy: { createdAt: "asc" } },
  receipts: {
    include: { items: true, destinationLocation: true },
    orderBy: [{ number: "asc" }],
  },
  returns: {
    include: { items: { include: { sourceLocation: true } } },
    orderBy: [{ number: "asc" }],
  },
} satisfies Prisma.PurchaseInclude;

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePurchaseDto, actorId: string) {
    const money = calculatePurchaseMoney(dto.items);
    this.ensureDistinctProducts(dto.items);
    try {
      const purchase = await this.prisma.runSerializable(
        async (transaction) => {
          await this.requireActiveSupplier(transaction, dto.supplierId);
          await this.requireActiveProducts(
            transaction,
            dto.items.map((item) => item.productId),
          );
          return transaction.purchase.create({
            data: {
              supplierId: dto.supplierId,
              supplierDocumentNumber: dto.supplierDocumentNumber?.trim(),
              documentDate: this.date(dto.documentDate),
              notes: dto.notes?.trim(),
              createdByActorId: actorId,
              subtotal: money.subtotal,
              discountTotal: money.discountTotal,
              taxTotal: money.taxTotal,
              total: money.total,
              items: { create: money.items },
            },
            include: purchaseDetailInclude,
          });
        },
      );
      return this.detail(purchase);
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Purchase contains duplicate Products");
    }
  }

  async findAll(query: ListPurchasesQueryDto) {
    const from = query.from ? this.date(query.from) : undefined;
    const to = query.to ? this.date(query.to) : undefined;
    if (from && to && from > to)
      throw new BadRequestException("Purchase document date range is invalid");
    const where: Prisma.PurchaseWhereInput = {
      supplierId: query.supplierId,
      status: query.status,
      number: query.number,
      supplierDocumentNumber: query.supplierDocumentNumber
        ? { contains: query.supplierDocumentNumber.trim(), mode: "insensitive" }
        : undefined,
      documentDate: from || to ? { gte: from, lte: to } : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        include: { supplier: true, _count: { select: { items: true } } },
        orderBy: [{ documentDate: "desc" }, { number: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.purchase.count({ where }),
    ]);
    return {
      data: data.map((purchase) => this.moneyHeader(purchase)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: purchaseDetailInclude,
    });
    if (!purchase) throw new NotFoundException("Purchase not found");
    return this.detail(purchase);
  }

  async update(id: string, dto: UpdatePurchaseDto) {
    if (dto.items) this.ensureDistinctProducts(dto.items);
    try {
      const purchase = await this.prisma.runSerializable(
        async (transaction) => {
          await this.lockPurchase(transaction, id);
          const current = await transaction.purchase.findUnique({
            where: { id },
          });
          if (!current) throw new NotFoundException("Purchase not found");
          if (current.status !== PurchaseStatus.DRAFT)
            throw new ConflictException("Only DRAFT purchases can be edited");
          if (dto.supplierId)
            await this.requireActiveSupplier(transaction, dto.supplierId);

          let money: ReturnType<typeof calculatePurchaseMoney> | undefined;
          if (dto.items) {
            await this.requireActiveProducts(
              transaction,
              dto.items.map((item) => item.productId),
            );
            money = calculatePurchaseMoney(dto.items);
            await transaction.purchaseItem.deleteMany({
              where: { purchaseId: id },
            });
          }
          return transaction.purchase.update({
            where: { id },
            data: {
              supplierId: dto.supplierId,
              supplierDocumentNumber: dto.supplierDocumentNumber?.trim(),
              documentDate: dto.documentDate
                ? this.date(dto.documentDate)
                : undefined,
              notes: dto.notes?.trim(),
              subtotal: money?.subtotal,
              discountTotal: money?.discountTotal,
              taxTotal: money?.taxTotal,
              total: money?.total,
              items: money ? { create: money.items } : undefined,
            },
            include: purchaseDetailInclude,
          });
        },
      );
      return this.detail(purchase);
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Purchase contains duplicate Products");
    }
  }

  async confirm(id: string, actorId: string) {
    const purchase = await this.prisma.runSerializable(async (transaction) => {
      await this.lockPurchase(transaction, id);
      const current = await transaction.purchase.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!current) throw new NotFoundException("Purchase not found");
      if (current.status !== PurchaseStatus.DRAFT)
        throw new ConflictException("Only a DRAFT purchase can be confirmed");
      await this.requireActiveSupplier(transaction, current.supplierId);
      await this.requireActiveProducts(
        transaction,
        current.items.map((item) => item.productId),
      );
      const money = calculatePurchaseMoney(
        current.items.map((item) => ({
          productId: item.productId,
          orderedQuantity: item.orderedQuantity,
          unitCost: item.unitCost.toString(),
          discountAmount: item.discountAmount.toString(),
          taxAmount: item.taxAmount.toString(),
        })),
      );
      return transaction.purchase.update({
        where: { id },
        data: {
          status: PurchaseStatus.CONFIRMED,
          subtotal: money.subtotal,
          discountTotal: money.discountTotal,
          taxTotal: money.taxTotal,
          total: money.total,
          confirmedAt: new Date(),
          confirmedByActorId: actorId,
        },
        include: purchaseDetailInclude,
      });
    });
    return this.detail(purchase);
  }

  async cancel(id: string, actorId: string) {
    const purchase = await this.prisma.runSerializable(async (transaction) => {
      await this.lockPurchase(transaction, id);
      const current = await transaction.purchase.findUnique({
        where: { id },
        include: {
          receipts: { where: { status: PurchasingDocumentStatus.POSTED } },
        },
      });
      if (!current) throw new NotFoundException("Purchase not found");
      if (
        (current.status !== PurchaseStatus.DRAFT &&
          current.status !== PurchaseStatus.CONFIRMED) ||
        current.receipts.length > 0
      )
        throw new ConflictException(
          "A purchase with posted receiving cannot be cancelled",
        );
      await transaction.purchaseReceipt.updateMany({
        where: { purchaseId: id, status: PurchasingDocumentStatus.DRAFT },
        data: { status: PurchasingDocumentStatus.CANCELLED },
      });
      return transaction.purchase.update({
        where: { id },
        data: {
          status: PurchaseStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledByActorId: actorId,
        },
        include: purchaseDetailInclude,
      });
    });
    return this.detail(purchase);
  }

  detail(
    purchase: Prisma.PurchaseGetPayload<{
      include: typeof purchaseDetailInclude;
    }>,
  ) {
    const items = purchase.items.map((item) => {
      const receivedQuantity = purchase.receipts
        .filter((receipt) => receipt.status === PurchasingDocumentStatus.POSTED)
        .flatMap((receipt) => receipt.items)
        .filter((receiptItem) => receiptItem.purchaseItemId === item.id)
        .reduce(
          (total, receiptItem) => total + receiptItem.quantityReceived,
          0,
        );
      const returnedQuantity = purchase.returns
        .filter(
          (purchaseReturn) =>
            purchaseReturn.status === PurchasingDocumentStatus.POSTED,
        )
        .flatMap((purchaseReturn) => purchaseReturn.items)
        .filter((returnItem) => returnItem.purchaseItemId === item.id)
        .reduce((total, returnItem) => total + returnItem.quantityReturned, 0);
      return {
        ...item,
        unitCost: item.unitCost.toFixed(4),
        discountAmount: item.discountAmount.toFixed(2),
        taxAmount: item.taxAmount.toFixed(2),
        lineSubtotal: item.lineSubtotal.toFixed(2),
        lineTotal: item.lineTotal.toFixed(2),
        receivedQuantity,
        returnedQuantity,
        remainingReceivableQuantity: item.orderedQuantity - receivedQuantity,
      };
    });
    return {
      ...this.moneyHeader(purchase),
      items,
      receiptSummary: purchase.receipts.map((receipt) => ({
        id: receipt.id,
        number: receipt.number,
        status: receipt.status,
        destinationLocation: receipt.destinationLocation,
        receivedAt: receipt.receivedAt,
        postedAt: receipt.postedAt,
      })),
      returnSummary: purchase.returns.map((purchaseReturn) => ({
        id: purchaseReturn.id,
        number: purchaseReturn.number,
        status: purchaseReturn.status,
        reason: purchaseReturn.reason,
        postedAt: purchaseReturn.postedAt,
      })),
    };
  }

  private moneyHeader<
    T extends {
      subtotal: Prisma.Decimal;
      discountTotal: Prisma.Decimal;
      taxTotal: Prisma.Decimal;
      total: Prisma.Decimal;
    },
  >(purchase: T) {
    return {
      ...purchase,
      subtotal: purchase.subtotal.toFixed(2),
      discountTotal: purchase.discountTotal.toFixed(2),
      taxTotal: purchase.taxTotal.toFixed(2),
      total: purchase.total.toFixed(2),
    };
  }

  private ensureDistinctProducts(items: CreatePurchaseItemDto[]) {
    if (new Set(items.map((item) => item.productId)).size !== items.length)
      throw new BadRequestException(
        "A Product may appear only once in a Purchase",
      );
  }

  private async requireActiveSupplier(
    transaction: Prisma.TransactionClient,
    id: string,
  ) {
    const supplier = await transaction.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException("Supplier not found");
    if (!supplier.active)
      throw new ConflictException("Inactive Supplier cannot be used");
  }

  private async requireActiveProducts(
    transaction: Prisma.TransactionClient,
    ids: string[],
  ) {
    const products = await transaction.product.findMany({
      where: { id: { in: ids }, active: true },
      select: { id: true },
    });
    if (products.length !== new Set(ids).size)
      throw new NotFoundException(
        "One or more Products are missing or inactive",
      );
  }

  private async lockPurchase(
    transaction: Prisma.TransactionClient,
    id: string,
  ) {
    await transaction.$queryRaw`
      SELECT "id" FROM "Purchase" WHERE "id" = ${id}::uuid FOR UPDATE
    `;
  }

  private date(value: string) {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }
}
