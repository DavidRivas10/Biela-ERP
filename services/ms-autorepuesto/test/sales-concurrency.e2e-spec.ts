import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common/interfaces";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AutorepuestoAuthGuard } from "../src/auth/guards/autorepuesto-auth.guard";
import { PrismaService } from "../src/database/prisma.service";

describe("Sales posting concurrency with PostgreSQL", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let categoryId: string;
  let brandId: string;
  let productA: string;
  let productB: string;
  let locationId: string;
  const suffix = Date.now().toString();
  const permissions = [
    "sales.read",
    "sales.create",
    "sales.post",
    "sales.return",
    "inventory.adjust",
  ];

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(AutorepuestoAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = {
            id: "sales-concurrency-actor",
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
        data: { code: `SC-CAT-${suffix}`, name: "Sales concurrency" },
      })
    ).id;
    brandId = (
      await prisma.productBrand.create({
        data: { code: `SC-BRAND-${suffix}`, name: "Sales concurrency" },
      })
    ).id;
    productA = (
      await prisma.product.create({
        data: {
          code: `SC-A-${suffix}`,
          name: "Concurrent Product A",
          categoryId,
          brandId,
          defaultSalePrice: "1",
        },
      })
    ).id;
    productB = (
      await prisma.product.create({
        data: {
          code: `SC-B-${suffix}`,
          name: "Concurrent Product B",
          categoryId,
          brandId,
          defaultSalePrice: "1",
        },
      })
    ).id;
    locationId = (
      await prisma.location.create({
        data: { code: `SC-LOC-${suffix}`, name: "Sales concurrency" },
      })
    ).id;
    await movement("INITIAL", productA, 1);
    await movement("INITIAL", productB, 1);
  });

  afterAll(async () => {
    const productIds = [productA, productB].filter(Boolean);
    const saleIds = (
      await prisma.saleItem.findMany({
        where: { productId: { in: productIds } },
        distinct: ["saleId"],
        select: { saleId: true },
      })
    ).map((item) => item.saleId);
    const returnIds = (
      await prisma.saleReturn.findMany({
        where: { saleId: { in: saleIds } },
        select: { id: true },
      })
    ).map((item) => item.id);
    await prisma.inventoryMovement.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.saleReturnItem.deleteMany({
      where: { saleReturnId: { in: returnIds } },
    });
    await prisma.saleReturn.deleteMany({ where: { id: { in: returnIds } } });
    await prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
    await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
    await prisma.inventory.deleteMany({
      where: { productId: { in: productIds } },
    });
    if (locationId) await prisma.location.delete({ where: { id: locationId } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    if (brandId) await prisma.productBrand.delete({ where: { id: brandId } });
    if (categoryId)
      await prisma.productCategory.delete({ where: { id: categoryId } });
    await app.close();
  });

  const movement = (
    type: "INITIAL" | "ADJUSTMENT",
    productId: string,
    quantity: number,
  ) =>
    request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type,
        productId,
        destinationLocationId: locationId,
        quantity,
        reason: "Sales concurrency fixture",
      })
      .expect(201);

  const setStock = (productId: string, quantity: number) =>
    movement("ADJUSTMENT", productId, quantity);

  const quantity = async (productId: string) =>
    (await prisma.inventory.findUnique({
      where: { productId_locationId: { productId, locationId } },
    }))!.quantity;

  const createSale = async (
    items: Array<{ productId: string; quantity: number }>,
  ) =>
    request(app.getHttpServer())
      .post("/sales")
      .send({
        documentDate: "2026-08-19",
        items: items.map((item) => ({
          ...item,
          sourceLocationId: locationId,
          unitPrice: "1",
        })),
      })
      .expect(201);

  it("prevents competing Sales from overselling 5 units with 4 + 4", async () => {
    await setStock(productA, 5);
    const [saleA, saleB] = await Promise.all([
      createSale([{ productId: productA, quantity: 4 }]),
      createSale([{ productId: productA, quantity: 4 }]),
    ]);
    const results = await Promise.all([
      request(app.getHttpServer()).post(`/sales/${saleA.body.id}/post`),
      request(app.getHttpServer()).post(`/sales/${saleB.body.id}/post`),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await quantity(productA)).toBe(1);
    expect(
      await prisma.inventoryMovement.count({
        where: {
          referenceType: "SALE",
          referenceId: { in: [saleA.body.id, saleB.body.id] },
        },
      }),
    ).toBe(1);
    expect(
      await prisma.sale.count({
        where: {
          id: { in: [saleA.body.id, saleB.body.id] },
          status: "POSTED",
        },
      }),
    ).toBe(1);
  });

  it("makes simultaneous POST requests for one Sale affect stock once", async () => {
    await setStock(productA, 5);
    const sale = await createSale([{ productId: productA, quantity: 4 }]);
    const results = await Promise.all([
      request(app.getHttpServer()).post(`/sales/${sale.body.id}/post`),
      request(app.getHttpServer()).post(`/sales/${sale.body.id}/post`),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await quantity(productA)).toBe(1);
    expect(
      await prisma.inventoryMovement.count({
        where: {
          referenceType: "SALE",
          referenceItemId: sale.body.items[0].id,
        },
      }),
    ).toBe(1);
  });

  it("prevents concurrent Returns from exceeding the sold quantity", async () => {
    await setStock(productA, 5);
    const sale = await createSale([{ productId: productA, quantity: 5 }]);
    await request(app.getHttpServer())
      .post(`/sales/${sale.body.id}/post`)
      .expect(201);
    const makeReturn = () =>
      request(app.getHttpServer())
        .post(`/sales/${sale.body.id}/returns`)
        .send({
          reason: "Concurrent Return",
          items: [
            {
              saleItemId: sale.body.items[0].id,
              destinationLocationId: locationId,
              quantityReturned: 3,
            },
          ],
        })
        .expect(201);
    const [returnA, returnB] = await Promise.all([makeReturn(), makeReturn()]);
    const results = await Promise.all([
      request(app.getHttpServer()).post(
        `/sale-returns/${returnA.body.id}/post`,
      ),
      request(app.getHttpServer()).post(
        `/sale-returns/${returnB.body.id}/post`,
      ),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await quantity(productA)).toBe(3);
    const aggregate = await prisma.saleReturnItem.aggregate({
      where: {
        saleItemId: sale.body.items[0].id,
        saleReturn: { status: "POSTED" },
      },
      _sum: { quantityReturned: true },
    });
    expect(aggregate._sum.quantityReturned).toBe(3);
  });

  it("keeps multi-line competing Sales atomic with coherent balances and ledger", async () => {
    await setStock(productA, 5);
    await setStock(productB, 2);
    const [saleA, saleB] = await Promise.all([
      createSale([
        { productId: productA, quantity: 4 },
        { productId: productB, quantity: 2 },
      ]),
      createSale([
        { productId: productA, quantity: 4 },
        { productId: productB, quantity: 1 },
      ]),
    ]);
    const results = await Promise.all([
      request(app.getHttpServer()).post(`/sales/${saleA.body.id}/post`),
      request(app.getHttpServer()).post(`/sales/${saleB.body.id}/post`),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    const posted = await prisma.sale.findFirstOrThrow({
      where: {
        id: { in: [saleA.body.id, saleB.body.id] },
        status: "POSTED",
      },
      include: { items: true },
    });
    const draftId = posted.id === saleA.body.id ? saleB.body.id : saleA.body.id;
    expect(await quantity(productA)).toBe(1);
    const soldB = posted.items.find(
      (item) => item.productId === productB,
    )!.quantity;
    expect(await quantity(productB)).toBe(2 - soldB);
    expect(
      await prisma.inventoryMovement.count({
        where: { referenceType: "SALE", referenceId: posted.id },
      }),
    ).toBe(2);
    expect(
      await prisma.inventoryMovement.count({
        where: { referenceType: "SALE", referenceId: draftId },
      }),
    ).toBe(0);
    expect(
      (await prisma.sale.findUnique({ where: { id: draftId } }))!.status,
    ).toBe("DRAFT");
  });
});
