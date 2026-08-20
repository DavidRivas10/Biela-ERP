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
import { CreatePurchaseReturnDto } from "./dto/purchase-return.dto";
import { FinancialSummaryService } from "../finance/financial-summary.service";

const returnInclude = {
  purchase: { select: { id: true, number: true, status: true } },
  items: {
    include: {
      purchaseItem: { include: { product: true } },
      sourceLocation: true,
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.PurchaseReturnInclude;

@Injectable()
export class PurchaseReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly financialSummaries: FinancialSummaryService,
  ) {}

  async create(
    purchaseId: string,
    dto: CreatePurchaseReturnDto,
    actorId: string,
  ) {
    this.ensureDistinctItems(
      dto.items.map(
        (item) => `${item.purchaseItemId}:${item.sourceLocationId}`,
      ),
    );
    try {
      return await this.prisma.runSerializable(async (transaction) => {
        await this.lockPurchase(transaction, purchaseId);
        const purchase = await this.requireReturnablePurchase(
          transaction,
          purchaseId,
        );
        const purchaseItems = await this.requireOwnedItems(
          transaction,
          purchaseId,
          dto.items.map((item) => item.purchaseItemId),
        );
        for (const locationId of new Set(
          dto.items.map((item) => item.sourceLocationId),
        ))
          await this.requireActiveLocation(transaction, locationId);
        const eligibility = await this.returnEligibility(
          transaction,
          purchaseItems.map((item) => item.id),
        );
        this.validateEligibility(dto.items, eligibility);
        return transaction.purchaseReturn.create({
          data: {
            purchaseId: purchase.id,
            reason: dto.reason.trim(),
            createdByActorId: actorId,
            items: { create: dto.items },
          },
          include: returnInclude,
        });
      });
    } catch (error: unknown) {
      throwMappedPrismaError(error, "Purchase Return contains duplicate items");
    }
  }

  async findAll(purchaseId: string, query: ListPurchasingDocumentsQueryDto) {
    await this.requirePurchase(this.prisma, purchaseId);
    const where: Prisma.PurchaseReturnWhereInput = {
      purchaseId,
      status: query.status,
    };
    const [data, total] = await Promise.all([
      this.prisma.purchaseReturn.findMany({
        where,
        include: returnInclude,
        orderBy: [{ number: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.purchaseReturn.count({ where }),
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
    const purchaseReturn = await this.prisma.purchaseReturn.findUnique({
      where: { id },
      include: returnInclude,
    });
    if (!purchaseReturn)
      throw new NotFoundException("Purchase Return not found");
    const inventoryMovements = await this.prisma.inventoryMovement.findMany({
      where: {
        referenceType: InventoryMovementReferenceType.PURCHASE_RETURN,
        referenceId: id,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const refundSummary = await this.financialSummaries.purchaseReturn(id);
    return { ...purchaseReturn, inventoryMovements, refundSummary };
  }

  async post(id: string, actorId: string) {
    try {
      return await this.prisma.runSerializable(async (transaction) => {
        const identity = await transaction.purchaseReturn.findUnique({
          where: { id },
          select: { purchaseId: true },
        });
        if (!identity) throw new NotFoundException("Purchase Return not found");
        await this.lockPurchase(transaction, identity.purchaseId);
        await this.lockReturn(transaction, id);
        const purchaseReturn = await transaction.purchaseReturn.findUnique({
          where: { id },
          include: returnInclude,
        });
        if (!purchaseReturn)
          throw new NotFoundException("Purchase Return not found");
        if (purchaseReturn.status !== PurchasingDocumentStatus.DRAFT)
          throw new ConflictException("Purchase Return is not postable");
        if (
          purchaseReturn.purchase.status !==
            PurchaseStatus.PARTIALLY_RECEIVED &&
          purchaseReturn.purchase.status !== PurchaseStatus.RECEIVED
        )
          throw new ConflictException("Purchase has no returnable receiving");
        const purchaseItems = await this.requireOwnedItems(
          transaction,
          purchaseReturn.purchaseId,
          purchaseReturn.items.map((item) => item.purchaseItemId),
        );
        for (const locationId of new Set(
          purchaseReturn.items.map((item) => item.sourceLocationId),
        ))
          await this.requireActiveLocation(transaction, locationId);
        const eligibility = await this.returnEligibility(
          transaction,
          purchaseItems.map((item) => item.id),
        );
        this.validateEligibility(purchaseReturn.items, eligibility);

        for (const item of purchaseReturn.items) {
          await this.inventory.createMovementInTransaction(
            transaction,
            {
              type: InventoryMovementType.OUT,
              productId: item.purchaseItem.productId,
              sourceLocationId: item.sourceLocationId,
              quantity: item.quantityReturned,
              reason: `Purchase Return #${purchaseReturn.number}`,
            },
            actorId,
            {
              type: InventoryMovementReferenceType.PURCHASE_RETURN,
              documentId: purchaseReturn.id,
              itemId: item.id,
            },
          );
        }
        const posted = await transaction.purchaseReturn.updateMany({
          where: { id, status: PurchasingDocumentStatus.DRAFT },
          data: {
            status: PurchasingDocumentStatus.POSTED,
            postedAt: new Date(),
            postedByActorId: actorId,
          },
        });
        if (posted.count !== 1)
          throw new ConflictException("Purchase Return was already posted");
        return transaction.purchaseReturn.findUniqueOrThrow({
          where: { id },
          include: returnInclude,
        });
      });
    } catch (error: unknown) {
      throwMappedPrismaError(
        error,
        "Purchase Return was already posted or conflicts with return history",
      );
    }
  }

  private async returnEligibility(
    transaction: Prisma.TransactionClient,
    purchaseItemIds: string[],
  ) {
    const [received, returned] = await Promise.all([
      transaction.purchaseReceiptItem.groupBy({
        by: ["purchaseItemId"],
        where: {
          purchaseItemId: { in: purchaseItemIds },
          receipt: { status: PurchasingDocumentStatus.POSTED },
        },
        _sum: { quantityReceived: true },
      }),
      transaction.purchaseReturnItem.groupBy({
        by: ["purchaseItemId"],
        where: {
          purchaseItemId: { in: purchaseItemIds },
          purchaseReturn: { status: PurchasingDocumentStatus.POSTED },
        },
        _sum: { quantityReturned: true },
      }),
    ]);
    const receivedMap = new Map(
      received.map((item) => [
        item.purchaseItemId,
        item._sum.quantityReceived ?? 0,
      ]),
    );
    const returnedMap = new Map(
      returned.map((item) => [
        item.purchaseItemId,
        item._sum.quantityReturned ?? 0,
      ]),
    );
    return new Map(
      purchaseItemIds.map((itemId) => [
        itemId,
        (receivedMap.get(itemId) ?? 0) - (returnedMap.get(itemId) ?? 0),
      ]),
    );
  }

  private validateEligibility(
    items: Array<{ purchaseItemId: string; quantityReturned: number }>,
    eligibility: Map<string, number>,
  ) {
    const requested = new Map<string, number>();
    for (const item of items)
      requested.set(
        item.purchaseItemId,
        (requested.get(item.purchaseItemId) ?? 0) + item.quantityReturned,
      );
    for (const [itemId, quantity] of requested)
      if (quantity > (eligibility.get(itemId) ?? 0))
        throw new ConflictException(
          "Purchase Return exceeds received quantity available for return",
        );
  }

  private async requireOwnedItems(
    transaction: Prisma.TransactionClient,
    purchaseId: string,
    ids: string[],
  ) {
    const uniqueIds = [...new Set(ids)];
    const items = await transaction.purchaseItem.findMany({
      where: { id: { in: uniqueIds }, purchaseId },
      select: { id: true },
    });
    if (items.length !== uniqueIds.length)
      throw new BadRequestException(
        "Every Return item must belong to the referenced Purchase",
      );
    return items;
  }

  private async requireReturnablePurchase(
    transaction: Prisma.TransactionClient,
    id: string,
  ) {
    const purchase = await this.requirePurchase(transaction, id);
    if (
      purchase.status !== PurchaseStatus.PARTIALLY_RECEIVED &&
      purchase.status !== PurchaseStatus.RECEIVED
    )
      throw new ConflictException("Purchase has no returnable receiving");
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
      throw new ConflictException("Inactive Location cannot return stock");
  }

  private ensureDistinctItems(keys: string[]) {
    if (new Set(keys).size !== keys.length)
      throw new BadRequestException(
        "A Purchase item and Location pair may appear only once in a Return",
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

  private async lockReturn(transaction: Prisma.TransactionClient, id: string) {
    await transaction.$queryRaw`
      SELECT "id" FROM "PurchaseReturn" WHERE "id" = ${id}::uuid FOR UPDATE
    `;
  }
}
