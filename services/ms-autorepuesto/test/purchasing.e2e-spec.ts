import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common/interfaces";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AutorepuestoAuthGuard } from "../src/auth/guards/autorepuesto-auth.guard";
import { PrismaService } from "../src/database/prisma.service";

describe("Purchasing lifecycle and Inventory integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let supplierId: string;
  let categoryId: string;
  let brandId: string;
  let productAId: string;
  let productBId: string;
  let locationId: string;
  let inactiveLocationId: string;
  let permissions: string[];
  const suffix = Date.now().toString();
  const actorId = "purchasing-test-actor";
  const allPermissions = [
    "purchases.read",
    "purchases.create",
    "purchases.update",
    "purchases.receive",
    "purchases.return",
    "inventory.read",
    "inventory.adjust",
  ];

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(AutorepuestoAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = {
            id: actorId,
            roles: [{ permissions }],
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    categoryId = (
      await prisma.productCategory.create({
        data: { code: `PUR-CAT-${suffix}`, name: "Purchase test category" },
      })
    ).id;
    brandId = (
      await prisma.productBrand.create({
        data: { code: `PUR-BRAND-${suffix}`, name: "Purchase test brand" },
      })
    ).id;
    productAId = (
      await prisma.product.create({
        data: {
          code: `PUR-A-${suffix}`,
          name: "Purchased Product A",
          categoryId,
          brandId,
        },
      })
    ).id;
    productBId = (
      await prisma.product.create({
        data: {
          code: `PUR-B-${suffix}`,
          name: "Purchased Product B",
          categoryId,
          brandId,
        },
      })
    ).id;
    supplierId = (
      await prisma.supplier.create({
        data: { code: `PUR-SUP-${suffix}`, businessName: "Purchase Supplier" },
      })
    ).id;
    locationId = (
      await prisma.location.create({
        data: { code: `PUR-LOC-${suffix}`, name: "Purchase receiving" },
      })
    ).id;
    inactiveLocationId = (
      await prisma.location.create({
        data: {
          code: `PUR-INACTIVE-${suffix}`,
          name: "Inactive receiving",
          active: false,
        },
      })
    ).id;
  });

  afterAll(async () => {
    const productIds = [productAId, productBId].filter(Boolean);
    if (productIds.length) {
      await prisma.inventoryMovement.deleteMany({
        where: { productId: { in: productIds } },
      });
      await prisma.inventory.deleteMany({
        where: { productId: { in: productIds } },
      });
    }
    if (supplierId) {
      const purchases = await prisma.purchase.findMany({
        where: { supplierId },
        select: { id: true },
      });
      const purchaseIds = purchases.map((purchase) => purchase.id);
      const items = await prisma.purchaseItem.findMany({
        where: { purchaseId: { in: purchaseIds } },
        select: { id: true },
      });
      const itemIds = items.map((item) => item.id);
      const receipts = await prisma.purchaseReceipt.findMany({
        where: { purchaseId: { in: purchaseIds } },
        select: { id: true },
      });
      const returns = await prisma.purchaseReturn.findMany({
        where: { purchaseId: { in: purchaseIds } },
        select: { id: true },
      });
      await prisma.purchaseReturnItem.deleteMany({
        where: { purchaseItemId: { in: itemIds } },
      });
      await prisma.purchaseReturn.deleteMany({
        where: { id: { in: returns.map((entry) => entry.id) } },
      });
      await prisma.purchaseReceiptItem.deleteMany({
        where: { receiptId: { in: receipts.map((entry) => entry.id) } },
      });
      await prisma.purchaseReceipt.deleteMany({
        where: { id: { in: receipts.map((entry) => entry.id) } },
      });
      await prisma.purchaseItem.deleteMany({ where: { id: { in: itemIds } } });
      await prisma.purchase.deleteMany({ where: { id: { in: purchaseIds } } });
      await prisma.supplier.delete({ where: { id: supplierId } });
    }
    const locationIds = [locationId, inactiveLocationId].filter(Boolean);
    if (locationIds.length)
      await prisma.location.deleteMany({ where: { id: { in: locationIds } } });
    if (productAId || productBId)
      await prisma.product.deleteMany({
        where: { id: { in: [productAId, productBId].filter(Boolean) } },
      });
    if (brandId) await prisma.productBrand.delete({ where: { id: brandId } });
    if (categoryId)
      await prisma.productCategory.delete({ where: { id: categoryId } });
    await app.close();
  });

  beforeEach(() => {
    permissions = [...allPermissions];
  });

  const createPurchase = async (
    items: Array<{
      productId: string;
      orderedQuantity: number;
      unitCost: string;
      discountAmount?: string;
      taxAmount?: string;
    }> = [{ productId: productAId, orderedQuantity: 10, unitCost: "2.50" }],
  ) =>
    request(app.getHttpServer())
      .post("/purchases")
      .send({
        supplierId,
        supplierDocumentNumber: `DOC-${randomUUID()}`,
        documentDate: "2026-08-19",
        items,
      })
      .expect(201);

  const quantity = async (productId: string) =>
    (
      await prisma.inventory.findUnique({
        where: { productId_locationId: { productId, locationId } },
      })
    )?.quantity ?? 0;

  it("enforces purchasing permissions", async () => {
    permissions = [];
    await request(app.getHttpServer()).get("/purchases").expect(403);
    await request(app.getHttpServer())
      .post("/purchases")
      .send({
        supplierId,
        documentDate: "2026-08-19",
        items: [{ productId: productAId, orderedQuantity: 1, unitCost: "1" }],
      })
      .expect(403);
  });

  it("rejects invalid references and quantities", async () => {
    await request(app.getHttpServer())
      .post("/purchases")
      .send({
        supplierId: randomUUID(),
        documentDate: "2026-08-19",
        items: [{ productId: productAId, orderedQuantity: 1, unitCost: "1" }],
      })
      .expect(404);
    await request(app.getHttpServer())
      .post("/purchases")
      .send({
        supplierId,
        documentDate: "2026-08-19",
        items: [{ productId: randomUUID(), orderedQuantity: 1, unitCost: "1" }],
      })
      .expect(404);
    await request(app.getHttpServer())
      .post("/purchases")
      .send({
        supplierId,
        documentDate: "2026-08-19",
        items: [{ productId: productAId, orderedQuantity: 0, unitCost: "1" }],
      })
      .expect(400);
  });

  it("creates, calculates, lists, and edits a DRAFT Purchase", async () => {
    const created = await createPurchase([
      {
        productId: productAId,
        orderedQuantity: 3,
        unitCost: "0.335",
        discountAmount: "0.01",
        taxAmount: "0.10",
      },
      {
        productId: productBId,
        orderedQuantity: 2,
        unitCost: "10.00",
        discountAmount: "1.00",
        taxAmount: "1.50",
      },
    ]);
    expect(created.body).toMatchObject({
      status: "DRAFT",
      subtotal: "21.01",
      discountTotal: "1.01",
      taxTotal: "1.60",
      total: "21.60",
      createdByActorId: actorId,
    });
    expect(created.body.number).toEqual(expect.any(Number));
    await request(app.getHttpServer())
      .patch(`/purchases/${created.body.id}`)
      .send({ notes: "Updated draft" })
      .expect(200)
      .expect((response) => expect(response.body.notes).toBe("Updated draft"));
    await request(app.getHttpServer())
      .get("/purchases")
      .query({ supplierId, number: created.body.number, page: 1, limit: 10 })
      .expect(200)
      .expect((response) =>
        expect(
          response.body.data.some(
            (row: { id: string }) => row.id === created.body.id,
          ),
        ).toBe(true),
      );
  });

  it("confirms without stock change, protects history, and enforces cancellation", async () => {
    const created = await createPurchase();
    const before = await quantity(productAId);
    await request(app.getHttpServer())
      .post(`/purchases/${created.body.id}/confirm`)
      .expect(201)
      .expect((response) => {
        expect(response.body.status).toBe("CONFIRMED");
        expect(response.body.confirmedByActorId).toBe(actorId);
      });
    expect(await quantity(productAId)).toBe(before);
    await request(app.getHttpServer())
      .patch(`/purchases/${created.body.id}`)
      .send({ notes: "forbidden edit" })
      .expect(409);

    const cancellable = await createPurchase();
    await request(app.getHttpServer())
      .post(`/purchases/${cancellable.body.id}/confirm`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/purchases/${cancellable.body.id}/cancel`)
      .expect(201)
      .expect((response) => expect(response.body.status).toBe("CANCELLED"));
    const draftCancellable = await createPurchase();
    await request(app.getHttpServer())
      .post(`/purchases/${draftCancellable.body.id}/cancel`)
      .expect(201)
      .expect((response) => expect(response.body.status).toBe("CANCELLED"));
  });

  it("posts partial and complete Receipts with traceable IN movements", async () => {
    const purchase = await createPurchase([
      { productId: productAId, orderedQuantity: 10, unitCost: "2.50" },
      { productId: productBId, orderedQuantity: 4, unitCost: "3.00" },
    ]);
    await request(app.getHttpServer())
      .post(`/purchases/${purchase.body.id}/confirm`)
      .expect(201);
    const [itemA, itemB] = purchase.body.items;

    await request(app.getHttpServer())
      .post(`/purchases/${purchase.body.id}/receipts`)
      .send({
        destinationLocationId: inactiveLocationId,
        items: [{ purchaseItemId: itemA.id, quantityReceived: 1 }],
      })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/purchases/${purchase.body.id}/receipts`)
      .send({
        destinationLocationId: randomUUID(),
        items: [{ purchaseItemId: itemA.id, quantityReceived: 1 }],
      })
      .expect(404);
    const foreignPurchase = await createPurchase();
    await request(app.getHttpServer())
      .post(`/purchases/${foreignPurchase.body.id}/confirm`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/purchases/${purchase.body.id}/receipts`)
      .send({
        destinationLocationId: locationId,
        items: [
          {
            purchaseItemId: foreignPurchase.body.items[0].id,
            quantityReceived: 1,
          },
        ],
      })
      .expect(400);

    const first = await request(app.getHttpServer())
      .post(`/purchases/${purchase.body.id}/receipts`)
      .send({
        destinationLocationId: locationId,
        items: [
          { purchaseItemId: itemA.id, quantityReceived: 6 },
          { purchaseItemId: itemB.id, quantityReceived: 4 },
        ],
      })
      .expect(201);
    const staleExcess = await request(app.getHttpServer())
      .post(`/purchases/${purchase.body.id}/receipts`)
      .send({
        destinationLocationId: locationId,
        items: [{ purchaseItemId: itemA.id, quantityReceived: 5 }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/purchase-receipts/${first.body.id}/post`)
      .expect(201);
    expect(await quantity(productAId)).toBe(6);
    expect(await quantity(productBId)).toBe(4);
    await request(app.getHttpServer())
      .get(`/purchases/${purchase.body.id}`)
      .expect(200)
      .expect((response) =>
        expect(response.body.status).toBe("PARTIALLY_RECEIVED"),
      );

    const movementsBeforeRejected = await prisma.inventoryMovement.count({
      where: { referenceId: staleExcess.body.id },
    });
    await request(app.getHttpServer())
      .post(`/purchase-receipts/${staleExcess.body.id}/post`)
      .expect(409);
    expect(
      await prisma.inventoryMovement.count({
        where: { referenceId: staleExcess.body.id },
      }),
    ).toBe(movementsBeforeRejected);

    const second = await request(app.getHttpServer())
      .post(`/purchases/${purchase.body.id}/receipts`)
      .send({
        destinationLocationId: locationId,
        items: [{ purchaseItemId: itemA.id, quantityReceived: 4 }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/purchase-receipts/${second.body.id}/post`)
      .expect(201);
    expect(await quantity(productAId)).toBe(10);
    await request(app.getHttpServer())
      .post(`/purchase-receipts/${second.body.id}/post`)
      .expect(409);
    expect(await quantity(productAId)).toBe(10);
    await request(app.getHttpServer())
      .get(`/purchase-receipts/${second.body.id}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe("POSTED");
        expect(response.body.inventoryMovements[0]).toMatchObject({
          type: "IN",
          referenceType: "PURCHASE_RECEIPT",
          referenceId: second.body.id,
          actorId,
        });
      });
    await request(app.getHttpServer())
      .get(`/purchases/${purchase.body.id}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe("RECEIVED");
        const detailA = response.body.items.find(
          (item: { id: string }) => item.id === itemA.id,
        );
        expect(detailA).toMatchObject({
          orderedQuantity: 10,
          receivedQuantity: 10,
          returnedQuantity: 0,
          remainingReceivableQuantity: 0,
        });
      });
    await request(app.getHttpServer())
      .post(`/purchases/${purchase.body.id}/cancel`)
      .expect(409);
  });

  it("posts eligible Returns through OUT and rejects over-return", async () => {
    const purchase = await createPurchase();
    await request(app.getHttpServer())
      .post(`/purchases/${purchase.body.id}/confirm`)
      .expect(201);
    const purchaseItemId = purchase.body.items[0].id;
    const receipt = await request(app.getHttpServer())
      .post(`/purchases/${purchase.body.id}/receipts`)
      .send({
        destinationLocationId: locationId,
        items: [{ purchaseItemId, quantityReceived: 10 }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/purchase-receipts/${receipt.body.id}/post`)
      .expect(201);
    const before = await quantity(productAId);
    await request(app.getHttpServer())
      .post(`/purchases/${purchase.body.id}/returns`)
      .send({
        reason: "   ",
        items: [
          {
            purchaseItemId,
            sourceLocationId: locationId,
            quantityReturned: 1,
          },
        ],
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/purchases/${purchase.body.id}/returns`)
      .send({
        reason: "Invalid Location",
        items: [
          {
            purchaseItemId,
            sourceLocationId: randomUUID(),
            quantityReturned: 1,
          },
        ],
      })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/purchases/${purchase.body.id}/returns`)
      .send({
        reason: "Inactive Location",
        items: [
          {
            purchaseItemId,
            sourceLocationId: inactiveLocationId,
            quantityReturned: 1,
          },
        ],
      })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/purchases/${purchase.body.id}/returns`)
      .send({
        reason: "Over received quantity",
        items: [
          {
            purchaseItemId,
            sourceLocationId: locationId,
            quantityReturned: 11,
          },
        ],
      })
      .expect(409);
    const validReturn = await request(app.getHttpServer())
      .post(`/purchases/${purchase.body.id}/returns`)
      .send({
        reason: "Damaged shipment",
        items: [
          { purchaseItemId, sourceLocationId: locationId, quantityReturned: 3 },
        ],
      })
      .expect(201);
    const staleExcess = await request(app.getHttpServer())
      .post(`/purchases/${purchase.body.id}/returns`)
      .send({
        reason: "Excess stale return",
        items: [
          { purchaseItemId, sourceLocationId: locationId, quantityReturned: 8 },
        ],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/purchase-returns/${validReturn.body.id}/post`)
      .expect(201);
    expect(await quantity(productAId)).toBe(before - 3);
    await request(app.getHttpServer())
      .post(`/purchase-returns/${validReturn.body.id}/post`)
      .expect(409);
    await request(app.getHttpServer())
      .post(`/purchase-returns/${staleExcess.body.id}/post`)
      .expect(409);
    expect(await quantity(productAId)).toBe(before - 3);
    await request(app.getHttpServer())
      .get(`/purchase-returns/${validReturn.body.id}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.inventoryMovements[0]).toMatchObject({
          type: "OUT",
          referenceType: "PURCHASE_RETURN",
          referenceId: validReturn.body.id,
          actorId,
        });
      });
    await request(app.getHttpServer())
      .get(`/purchases/${purchase.body.id}`)
      .expect(200)
      .expect((response) =>
        expect(response.body.items[0]).toMatchObject({
          orderedQuantity: 10,
          receivedQuantity: 10,
          returnedQuantity: 3,
          remainingReceivableQuantity: 0,
        }),
      );
  });

  it("rolls back a Return when physical stock is unavailable", async () => {
    const purchase = await createPurchase([
      { productId: productBId, orderedQuantity: 2, unitCost: "1.00" },
    ]);
    await request(app.getHttpServer())
      .post(`/purchases/${purchase.body.id}/confirm`)
      .expect(201);
    const purchaseItemId = purchase.body.items[0].id;
    const receipt = await request(app.getHttpServer())
      .post(`/purchases/${purchase.body.id}/receipts`)
      .send({
        destinationLocationId: locationId,
        items: [{ purchaseItemId, quantityReceived: 2 }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/purchase-receipts/${receipt.body.id}/post`)
      .expect(201);
    const purchaseReturn = await request(app.getHttpServer())
      .post(`/purchases/${purchase.body.id}/returns`)
      .send({
        reason: "Return without remaining physical stock",
        items: [
          { purchaseItemId, sourceLocationId: locationId, quantityReturned: 1 },
        ],
      })
      .expect(201);
    const physicalBefore = await quantity(productBId);
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "OUT",
        productId: productBId,
        sourceLocationId: locationId,
        quantity: physicalBefore,
        reason: "Test physical depletion",
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/purchase-returns/${purchaseReturn.body.id}/post`)
      .expect(409);
    expect(await quantity(productBId)).toBe(0);
    expect(
      await prisma.inventoryMovement.count({
        where: { referenceId: purchaseReturn.body.id },
      }),
    ).toBe(0);
    await request(app.getHttpServer())
      .get(`/purchase-returns/${purchaseReturn.body.id}`)
      .expect(200)
      .expect((response) => expect(response.body.status).toBe("DRAFT"));
  });
});
