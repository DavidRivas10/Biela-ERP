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
  PurchaseStatus,
  PurchasingDocumentStatus,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { throwMappedPrismaError } from "../database/prisma-error.util";
import { InventoryService } from "../inventory/inventory.service";
import { ListPurchasingDocumentsQueryDto } from "./dto/list-purchasing-documents-query.dto";
import { CreatePurchaseReceiptDto } from "./dto/purchase-receipt.dto";

const receiptInclude = {
  purchase: { select: { id: true, number: true, status: true } },
  destinationLocation: true,
  items: {
    include: {
      purchaseItem: { include: { product: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.PurchaseReceiptInclude;

@Injectable()
export class PurchaseReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async create(
    purchaseId: string,
    dto: CreatePurchaseReceiptDto,
    actorId: string,
  ) {
    this.ensureDistinctItems(dto.items.map((item) => item.purchaseItemId));
    try {
      return await this.prisma.runSerializable(async (transaction) => {
        await this.lockPurchase(transaction, purchaseId);
        const purchase = await this.requireReceivablePurchase(
          transaction,
          purchaseId,
        );
        await this.requireActiveLocation(
          transaction,
          dto.destinationLocationId,
        );
        const purchaseItems = await this.requireOwnedItems(
          transaction,
          purchaseId,
          dto.items.map((item) => item.purchaseItemId),
        );
        const received = await this.receivedByItem(
          transaction,
          purchaseItems.map((item) => item.id),
        );
        for (const item of dto.items) {
          const ordered = purchaseItems.find(
            (purchaseItem) => purchaseItem.id === item.purchaseItemId,
          )!.orderedQuantity;
          if (
            (received.get(item.purchaseItemId) ?? 0) + item.quantityReceived >
            ordered
          )
            throw new ConflictException("Receipt exceeds ordered quantity");
        }
        return transaction.purchaseReceipt.create({
          data: {
            purchaseId: purchase.id,
            destinationLocationId: dto.destinationLocationId,
            receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : undefined,
            notes: dto.notes?.trim(),
            createdByActorId: actorId,
            items: { create: dto.items },
          },
          include: receiptInclude,
        });
      });
    } catch (error: unknown) {
      throwMappedPrismaError(
        error,
        "Receipt contains duplicate Purchase items",
      );
    }
  }

  async findAll(purchaseId: string, query: ListPurchasingDocumentsQueryDto) {
    await this.requirePurchase(this.prisma, purchaseId);
    const where: Prisma.PurchaseReceiptWhereInput = {
      purchaseId,
      status: query.status,
    };
    const [data, total] = await Promise.all([
      this.prisma.purchaseReceipt.findMany({
        where,
        include: receiptInclude,
        orderBy: [{ number: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.purchaseReceipt.count({ where }),
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
    const receipt = await this.prisma.purchaseReceipt.findUnique({
      where: { id },
      include: receiptInclude,
    });
    if (!receipt) throw new NotFoundException("Purchase Receipt not found");
    const inventoryMovements = await this.prisma.inventoryMovement.findMany({
      where: {
        referenceType: InventoryMovementReferenceType.PURCHASE_RECEIPT,
        referenceId: id,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return { ...receipt, inventoryMovements };
  }

  async post(id: string, actorId: string) {
    try {
      return await this.prisma.runSerializable(async (transaction) => {
        const receiptIdentity = await transaction.purchaseReceipt.findUnique({
          where: { id },
          select: { purchaseId: true },
        });
        if (!receiptIdentity)
          throw new NotFoundException("Purchase Receipt not found");
        await this.lockPurchase(transaction, receiptIdentity.purchaseId);
        await this.lockReceipt(transaction, id);
        const receipt = await transaction.purchaseReceipt.findUnique({
          where: { id },
          include: receiptInclude,
        });
        if (!receipt) throw new NotFoundException("Purchase Receipt not found");
        if (receipt.status !== PurchasingDocumentStatus.DRAFT)
          throw new ConflictException("Purchase Receipt is not postable");
        if (
          receipt.purchase.status !== PurchaseStatus.CONFIRMED &&
          receipt.purchase.status !== PurchaseStatus.PARTIALLY_RECEIVED
        )
          throw new ConflictException("Purchase is not open for receiving");
        await this.requireActiveLocation(
          transaction,
          receipt.destinationLocationId,
        );
        const purchaseItems = await this.requireOwnedItems(
          transaction,
          receipt.purchaseId,
          receipt.items.map((item) => item.purchaseItemId),
        );
        const received = await this.receivedByItem(
          transaction,
          purchaseItems.map((item) => item.id),
        );
        for (const item of receipt.items) {
          const ordered = purchaseItems.find(
            (purchaseItem) => purchaseItem.id === item.purchaseItemId,
          )!.orderedQuantity;
          if (
            (received.get(item.purchaseItemId) ?? 0) + item.quantityReceived >
            ordered
          )
            throw new ConflictException("Receipt exceeds ordered quantity");
        }

        for (const item of receipt.items) {
          await this.inventory.createMovementInTransaction(
            transaction,
            {
              type: InventoryMovementType.IN,
              productId: item.purchaseItem.productId,
              destinationLocationId: receipt.destinationLocationId,
              quantity: item.quantityReceived,
              reason: `Purchase Receipt #${receipt.number}`,
            },
            actorId,
            {
              type: InventoryMovementReferenceType.PURCHASE_RECEIPT,
              documentId: receipt.id,
              itemId: item.id,
            },
          );
        }
        const posted = await transaction.purchaseReceipt.updateMany({
          where: { id, status: PurchasingDocumentStatus.DRAFT },
          data: {
            status: PurchasingDocumentStatus.POSTED,
            postedAt: new Date(),
            postedByActorId: actorId,
            receivedAt: receipt.receivedAt ?? new Date(),
          },
        });
        if (posted.count !== 1)
          throw new ConflictException("Purchase Receipt was already posted");

        const allPurchaseItems = await transaction.purchaseItem.findMany({
          where: { purchaseId: receipt.purchaseId },
          select: { id: true, orderedQuantity: true },
        });
        const cumulative = await this.receivedByItem(
          transaction,
          allPurchaseItems.map((item) => item.id),
        );
        const complete = allPurchaseItems.every(
          (item) => (cumulative.get(item.id) ?? 0) === item.orderedQuantity,
        );
        await transaction.purchase.update({
          where: { id: receipt.purchaseId },
          data: {
            status: complete
              ? PurchaseStatus.RECEIVED
              : PurchaseStatus.PARTIALLY_RECEIVED,
          },
        });
        return transaction.purchaseReceipt.findUniqueOrThrow({
          where: { id },
          include: receiptInclude,
        });
      });
    } catch (error: unknown) {
      throwMappedPrismaError(
        error,
        "Purchase Receipt was already posted or conflicts with receiving history",
      );
    }
  }

  private async receivedByItem(
    transaction: Prisma.TransactionClient,
    purchaseItemIds: string[],
  ) {
    const totals = await transaction.purchaseReceiptItem.groupBy({
      by: ["purchaseItemId"],
      where: {
        purchaseItemId: { in: purchaseItemIds },
        receipt: { status: PurchasingDocumentStatus.POSTED },
      },
      _sum: { quantityReceived: true },
    });
    return new Map(
      totals.map((total) => [
        total.purchaseItemId,
        total._sum.quantityReceived ?? 0,
      ]),
    );
  }

  private async requireOwnedItems(
    transaction: Prisma.TransactionClient,
    purchaseId: string,
    ids: string[],
  ) {
    const items = await transaction.purchaseItem.findMany({
      where: { id: { in: ids }, purchaseId },
      select: { id: true, orderedQuantity: true, productId: true },
    });
    if (items.length !== new Set(ids).size)
      throw new BadRequestException(
        "Every Receipt item must belong to the referenced Purchase",
      );
    return items;
  }

  private async requireReceivablePurchase(
    transaction: Prisma.TransactionClient,
    id: string,
  ) {
    const purchase = await this.requirePurchase(transaction, id);
    if (
      purchase.status !== PurchaseStatus.CONFIRMED &&
      purchase.status !== PurchaseStatus.PARTIALLY_RECEIVED
    )
      throw new ConflictException("Purchase is not open for receiving");
    return purchase;
  }

  private async requirePurchase(
    client: Prisma.TransactionClient | PrismaService,
    id: string,
  ) {
    const purchase = await client.purchase.findUnique({ where: { id } });
    if (!purchase) throw new NotFoundException("Purchase not found");
    return purchase;
  }

  private async requireActiveLocation(
    transaction: Prisma.TransactionClient,
    id: string,
  ) {
    const location = await transaction.location.findUnique({ where: { id } });
    if (!location) throw new NotFoundException("Location not found");
    if (!location.active)
      throw new ConflictException("Inactive Location cannot receive stock");
  }

  private ensureDistinctItems(ids: string[]) {
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException(
        "A Purchase item may appear only once in a Receipt",
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

  private async lockReceipt(transaction: Prisma.TransactionClient, id: string) {
    await transaction.$queryRaw`
      SELECT "id" FROM "PurchaseReceipt" WHERE "id" = ${id}::uuid FOR UPDATE
    `;
  }
}
