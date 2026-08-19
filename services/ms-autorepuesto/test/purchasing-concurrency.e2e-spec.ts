import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common/interfaces";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AutorepuestoAuthGuard } from "../src/auth/guards/autorepuesto-auth.guard";
import { PrismaService } from "../src/database/prisma.service";

describe("Purchasing posting concurrency with PostgreSQL", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let supplierId: string;
  let categoryId: string;
  let brandId: string;
  let productId: string;
  const locationIds: string[] = [];
  const suffix = Date.now().toString();
  const permissions = [
    "purchases.read",
    "purchases.create",
    "purchases.update",
    "purchases.receive",
    "purchases.return",
    "inventory.adjust",
  ];

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(AutorepuestoAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = {
            id: "purchase-concurrency-actor",
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
        data: { code: `CON-CAT-${suffix}`, name: "Concurrency category" },
      })
    ).id;
    brandId = (
      await prisma.productBrand.create({
        data: { code: `CON-BRAND-${suffix}`, name: "Concurrency brand" },
      })
    ).id;
    productId = (
      await prisma.product.create({
        data: {
          code: `CON-PROD-${suffix}`,
          name: "Concurrency Product",
          categoryId,
          brandId,
        },
      })
    ).id;
    supplierId = (
      await prisma.supplier.create({
        data: {
          code: `CON-SUP-${suffix}`,
          businessName: "Concurrency Supplier",
        },
      })
    ).id;
  });

  afterAll(async () => {
    if (productId) {
      await prisma.inventoryMovement.deleteMany({ where: { productId } });
      await prisma.inventory.deleteMany({ where: { productId } });
    }
    if (supplierId) {
      const purchaseIds = (
        await prisma.purchase.findMany({
          where: { supplierId },
          select: { id: true },
        })
      ).map((purchase) => purchase.id);
      const itemIds = (
        await prisma.purchaseItem.findMany({
          where: { purchaseId: { in: purchaseIds } },
          select: { id: true },
        })
      ).map((item) => item.id);
      const receiptIds = (
        await prisma.purchaseReceipt.findMany({
          where: { purchaseId: { in: purchaseIds } },
          select: { id: true },
        })
      ).map((receipt) => receipt.id);
      const returnIds = (
        await prisma.purchaseReturn.findMany({
          where: { purchaseId: { in: purchaseIds } },
          select: { id: true },
        })
      ).map((purchaseReturn) => purchaseReturn.id);
      await prisma.purchaseReturnItem.deleteMany({
        where: { purchaseReturnId: { in: returnIds } },
      });
      await prisma.purchaseReturn.deleteMany({
        where: { id: { in: returnIds } },
      });
      await prisma.purchaseReceiptItem.deleteMany({
        where: { receiptId: { in: receiptIds } },
      });
      await prisma.purchaseReceipt.deleteMany({
        where: { id: { in: receiptIds } },
      });
      await prisma.purchaseItem.deleteMany({ where: { id: { in: itemIds } } });
      await prisma.purchase.deleteMany({ where: { id: { in: purchaseIds } } });
      await prisma.supplier.delete({ where: { id: supplierId } });
    }
    if (locationIds.length)
      await prisma.location.deleteMany({ where: { id: { in: locationIds } } });
    if (productId) await prisma.product.delete({ where: { id: productId } });
    if (brandId) await prisma.productBrand.delete({ where: { id: brandId } });
    if (categoryId)
      await prisma.productCategory.delete({ where: { id: categoryId } });
    await app.close();
  });

  const createScenario = async (orderedQuantity = 10) => {
    const location = await prisma.location.create({
      data: {
        code: `CON-LOC-${suffix}-${locationIds.length + 1}`,
        name: "Concurrency Location",
      },
    });
    locationIds.push(location.id);
    const purchase = await request(app.getHttpServer())
      .post("/purchases")
      .send({
        supplierId,
        documentDate: "2026-08-19",
        items: [{ productId, orderedQuantity, unitCost: "1.00" }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/purchases/${purchase.body.id}/confirm`)
      .expect(201);
    return {
      purchaseId: purchase.body.id as string,
      purchaseItemId: purchase.body.items[0].id as string,
      locationId: location.id,
    };
  };

  const createReceipt = (
    scenario: Awaited<ReturnType<typeof createScenario>>,
    quantity: number,
  ) =>
    request(app.getHttpServer())
      .post(`/purchases/${scenario.purchaseId}/receipts`)
      .send({
        destinationLocationId: scenario.locationId,
        items: [
          {
            purchaseItemId: scenario.purchaseItemId,
            quantityReceived: quantity,
          },
        ],
      })
      .expect(201);

  const inventoryQuantity = async (locationId: string) =>
    (
      await prisma.inventory.findUnique({
        where: { productId_locationId: { productId, locationId } },
      })
    )?.quantity ?? 0;

  it("prevents concurrent Receipts from cumulatively over-receiving", async () => {
    const scenario = await createScenario(10);
    const [receiptA, receiptB] = await Promise.all([
      createReceipt(scenario, 6),
      createReceipt(scenario, 6),
    ]);
    const results = await Promise.all([
      request(app.getHttpServer()).post(
        `/purchase-receipts/${receiptA.body.id}/post`,
      ),
      request(app.getHttpServer()).post(
        `/purchase-receipts/${receiptB.body.id}/post`,
      ),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await inventoryQuantity(scenario.locationId)).toBe(6);
    const purchase = await request(app.getHttpServer())
      .get(`/purchases/${scenario.purchaseId}`)
      .expect(200);
    expect(purchase.body.items[0].receivedQuantity).toBe(6);
    expect(purchase.body.items[0].receivedQuantity).toBeLessThanOrEqual(10);
  });

  it("makes concurrent posting of the same Receipt idempotent", async () => {
    const scenario = await createScenario(5);
    const receipt = await createReceipt(scenario, 5);
    const results = await Promise.all([
      request(app.getHttpServer()).post(
        `/purchase-receipts/${receipt.body.id}/post`,
      ),
      request(app.getHttpServer()).post(
        `/purchase-receipts/${receipt.body.id}/post`,
      ),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await inventoryQuantity(scenario.locationId)).toBe(5);
    expect(
      await prisma.inventoryMovement.count({
        where: {
          referenceType: "PURCHASE_RECEIPT",
          referenceItemId: receipt.body.items[0].id,
        },
      }),
    ).toBe(1);
  });

  it("prevents concurrent Returns from exceeding commercial eligibility", async () => {
    const scenario = await createScenario(10);
    const receipt = await createReceipt(scenario, 10);
    await request(app.getHttpServer())
      .post(`/purchase-receipts/${receipt.body.id}/post`)
      .expect(201);
    const makeReturn = () =>
      request(app.getHttpServer())
        .post(`/purchases/${scenario.purchaseId}/returns`)
        .send({
          reason: "Concurrent eligibility test",
          items: [
            {
              purchaseItemId: scenario.purchaseItemId,
              sourceLocationId: scenario.locationId,
              quantityReturned: 6,
            },
          ],
        })
        .expect(201);
    const [returnA, returnB] = await Promise.all([makeReturn(), makeReturn()]);
    const results = await Promise.all([
      request(app.getHttpServer()).post(
        `/purchase-returns/${returnA.body.id}/post`,
      ),
      request(app.getHttpServer()).post(
        `/purchase-returns/${returnB.body.id}/post`,
      ),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await inventoryQuantity(scenario.locationId)).toBe(4);
    const purchase = await request(app.getHttpServer())
      .get(`/purchases/${scenario.purchaseId}`)
      .expect(200);
    expect(purchase.body.items[0].returnedQuantity).toBe(6);
    expect(purchase.body.items[0].returnedQuantity).toBeLessThanOrEqual(
      purchase.body.items[0].receivedQuantity,
    );
  });

  it("prevents concurrent Returns from making physical stock negative", async () => {
    const scenario = await createScenario(10);
    const receipt = await createReceipt(scenario, 10);
    await request(app.getHttpServer())
      .post(`/purchase-receipts/${receipt.body.id}/post`)
      .expect(201);
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "OUT",
        productId,
        sourceLocationId: scenario.locationId,
        quantity: 4,
        reason: "Create constrained physical stock",
      })
      .expect(201);
    const makeReturn = () =>
      request(app.getHttpServer())
        .post(`/purchases/${scenario.purchaseId}/returns`)
        .send({
          reason: "Concurrent physical stock test",
          items: [
            {
              purchaseItemId: scenario.purchaseItemId,
              sourceLocationId: scenario.locationId,
              quantityReturned: 4,
            },
          ],
        })
        .expect(201);
    const [returnA, returnB] = await Promise.all([makeReturn(), makeReturn()]);
    const results = await Promise.all([
      request(app.getHttpServer()).post(
        `/purchase-returns/${returnA.body.id}/post`,
      ),
      request(app.getHttpServer()).post(
        `/purchase-returns/${returnB.body.id}/post`,
      ),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await inventoryQuantity(scenario.locationId)).toBe(2);
    const negative = await prisma.inventory.count({
      where: {
        productId,
        locationId: scenario.locationId,
        quantity: { lt: 0 },
      },
    });
    expect(negative).toBe(0);
  });
});
