import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common/interfaces";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AutorepuestoAuthGuard } from "../src/auth/guards/autorepuesto-auth.guard";
import { PrismaService } from "../src/database/prisma.service";

describe("Customers, Sales, and Sales Returns HTTP", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authenticated = true;
  let permissions: string[];
  let categoryId: string;
  let brandId: string;
  let productId: string;
  let secondProductId: string;
  let locationId: string;
  let secondLocationId: string;
  let customerId: string;
  const suffix = Date.now().toString();
  const allPermissions = [
    "customers.read",
    "customers.create",
    "customers.update",
    "sales.read",
    "sales.create",
    "sales.update",
    "sales.post",
    "sales.return",
    "products.update",
    "inventory.adjust",
  ];

  beforeAll(async () => {
    permissions = [...allPermissions];
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(AutorepuestoAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          if (!authenticated) throw new UnauthorizedException();
          context.switchToHttp().getRequest().user = {
            id: "sales-e2e-actor",
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
        data: { code: `SALE-CAT-${suffix}`, name: "Sales category" },
      })
    ).id;
    brandId = (
      await prisma.productBrand.create({
        data: { code: `SALE-BRAND-${suffix}`, name: "Sales brand" },
      })
    ).id;
    productId = (
      await prisma.product.create({
        data: {
          code: `SALE-PROD-${suffix}`,
          name: "Sales Product",
          categoryId,
          brandId,
          defaultSalePrice: "10.1234",
        },
      })
    ).id;
    secondProductId = (
      await prisma.product.create({
        data: {
          code: `SALE-PROD2-${suffix}`,
          name: "Second Sales Product",
          categoryId,
          brandId,
          defaultSalePrice: "5.0000",
        },
      })
    ).id;
    locationId = (
      await prisma.location.create({
        data: { code: `SALE-LOC-${suffix}`, name: "Sales Location" },
      })
    ).id;
    secondLocationId = (
      await prisma.location.create({
        data: { code: `SALE-LOC2-${suffix}`, name: "Second Location" },
      })
    ).id;
    await initial(productId, locationId, 20);
    await initial(secondProductId, locationId, 20);
    await initial(productId, secondLocationId, 1);
    await setStock(productId, secondLocationId, 0);
  });

  afterAll(async () => {
    const productIds = [productId, secondProductId].filter(Boolean);
    const saleIds = (
      await prisma.saleItem.findMany({
        where: { productId: { in: productIds } },
        select: { saleId: true },
        distinct: ["saleId"],
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
    if (customerId)
      await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.inventory.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.location.deleteMany({
      where: { id: { in: [locationId, secondLocationId].filter(Boolean) } },
    });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    if (brandId) await prisma.productBrand.delete({ where: { id: brandId } });
    if (categoryId)
      await prisma.productCategory.delete({ where: { id: categoryId } });
    await app.close();
  });

  const initial = async (product: string, location: string, quantity: number) =>
    request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "INITIAL",
        productId: product,
        destinationLocationId: location,
        quantity,
        reason: "Sales deterministic fixture",
      })
      .expect(201);

  const setStock = async (
    product: string,
    location: string,
    quantity: number,
  ) =>
    request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "ADJUSTMENT",
        productId: product,
        destinationLocationId: location,
        quantity,
        reason: "Reset Sales test stock",
      })
      .expect(201);

  const quantity = async (product: string, location: string) =>
    (await prisma.inventory.findUnique({
      where: {
        productId_locationId: { productId: product, locationId: location },
      },
    }))!.quantity;

  const createSale = async (
    items: Array<Record<string, unknown>>,
    customer: string | null = customerId,
  ) =>
    request(app.getHttpServer())
      .post("/sales")
      .send({
        ...(customer === null ? {} : { customerId: customer }),
        documentDate: "2026-08-19",
        items,
      })
      .expect(201);

  it("manages normalized Customers, filters, validation, and soft lifecycle", async () => {
    const created = await request(app.getHttpServer())
      .post("/customers")
      .send({
        code: ` cus-${suffix} `,
        name: " Customer One ",
        businessName: "Customer Trading",
        taxId: "0801",
        email: "CUSTOMER@EXAMPLE.INVALID",
      })
      .expect(201);
    customerId = created.body.id;
    expect(created.body.code).toBe(`CUS-${suffix}`);
    expect(created.body.name).toBe("Customer One");
    expect(created.body.email).toBe("customer@example.invalid");
    await request(app.getHttpServer())
      .post("/customers")
      .send({ code: `CUS-${suffix}`, name: "Duplicate" })
      .expect(409);
    await request(app.getHttpServer())
      .post("/customers")
      .send({ code: `BAD-${suffix}`, name: "Bad", email: "not-email" })
      .expect(400);
    const listed = await request(app.getHttpServer())
      .get(`/customers?search=${suffix}&taxId=0801&active=true&page=1&limit=5`)
      .expect(200);
    expect(listed.body.data.map((item: { id: string }) => item.id)).toContain(
      customerId,
    );
    await request(app.getHttpServer())
      .patch(`/customers/${customerId}`)
      .send({ phone: "+504 2200-0000" })
      .expect(200)
      .expect(({ body }) => expect(body.phone).toBe("+504 2200-0000"));
  });

  it("rejects an inactive Customer for new work but keeps historical Sale readable", async () => {
    const historical = await createSale([
      { productId, sourceLocationId: locationId, quantity: 1 },
    ]);
    await request(app.getHttpServer())
      .patch(`/customers/${customerId}/deactivate`)
      .expect(200);
    await request(app.getHttpServer())
      .post("/sales")
      .send({
        customerId,
        documentDate: "2026-08-19",
        items: [{ productId, sourceLocationId: locationId, quantity: 1 }],
      })
      .expect(409);
    await request(app.getHttpServer())
      .get(`/sales/${historical.body.id}`)
      .expect(200)
      .expect(({ body }) => expect(body.customer.active).toBe(false));
    await request(app.getHttpServer())
      .patch(`/customers/${customerId}/activate`)
      .expect(200);
  });

  it("creates and edits DRAFT exact-money Sales without changing Inventory", async () => {
    await setStock(productId, locationId, 20);
    const before = await quantity(productId, locationId);
    const sale = await createSale([
      {
        productId,
        sourceLocationId: locationId,
        quantity: 3,
        discountAmount: "0.10",
        taxAmount: "1.25",
      },
    ]);
    expect(sale.body.items[0].unitPrice).toBe("10.1234");
    expect(sale.body.subtotal).toBe("30.37");
    expect(sale.body.total).toBe("31.52");
    expect(await quantity(productId, locationId)).toBe(before);
    const edited = await request(app.getHttpServer())
      .patch(`/sales/${sale.body.id}`)
      .send({
        notes: "Edited draft",
        items: [
          {
            productId,
            sourceLocationId: locationId,
            quantity: 2,
            unitPrice: "9.9999",
            discountAmount: "0.01",
            taxAmount: "0.02",
          },
        ],
      })
      .expect(200);
    expect(edited.body.subtotal).toBe("20.00");
    expect(edited.body.total).toBe("20.01");
    expect(await quantity(productId, locationId)).toBe(before);
  });

  it("snapshots Product price and never reprices historical Sale items", async () => {
    const sale = await createSale([
      { productId, sourceLocationId: locationId, quantity: 1 },
    ]);
    await request(app.getHttpServer())
      .patch(`/products/${productId}`)
      .send({ defaultSalePrice: "15.0000" })
      .expect(200);
    const detail = await request(app.getHttpServer())
      .get(`/sales/${sale.body.id}`)
      .expect(200);
    expect(detail.body.items[0].unitPrice).toBe("10.1234");
  });

  it("posts once, decrements stock, records traceability, and becomes immutable", async () => {
    await setStock(productId, locationId, 10);
    const sale = await createSale([
      { productId, sourceLocationId: locationId, quantity: 4, unitPrice: "12" },
    ]);
    const posted = await request(app.getHttpServer())
      .post(`/sales/${sale.body.id}/post`)
      .expect(201);
    expect(posted.body.status).toBe("POSTED");
    expect(posted.body.postedByActorId).toBe("sales-e2e-actor");
    expect(await quantity(productId, locationId)).toBe(6);
    const detail = await request(app.getHttpServer())
      .get(`/sales/${sale.body.id}`)
      .expect(200);
    expect(detail.body.inventoryMovements).toHaveLength(1);
    expect(detail.body.inventoryMovements[0]).toMatchObject({
      type: "OUT",
      referenceType: "SALE",
      referenceId: sale.body.id,
      referenceItemId: sale.body.items[0].id,
    });
    await request(app.getHttpServer())
      .post(`/sales/${sale.body.id}/post`)
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/sales/${sale.body.id}`)
      .send({ notes: "Forbidden" })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/sales/${sale.body.id}/cancel`)
      .expect(409);
    expect(await quantity(productId, locationId)).toBe(6);
  });

  it("rolls back every line when one Product has insufficient stock", async () => {
    await setStock(productId, locationId, 5);
    await setStock(secondProductId, locationId, 1);
    const sale = await createSale([
      { productId, sourceLocationId: locationId, quantity: 2, unitPrice: "1" },
      {
        productId: secondProductId,
        sourceLocationId: locationId,
        quantity: 3,
        unitPrice: "1",
      },
    ]);
    await request(app.getHttpServer())
      .post(`/sales/${sale.body.id}/post`)
      .expect(409);
    expect(await quantity(productId, locationId)).toBe(5);
    expect(await quantity(secondProductId, locationId)).toBe(1);
    expect(
      await prisma.inventoryMovement.count({
        where: { referenceType: "SALE", referenceId: sale.body.id },
      }),
    ).toBe(0);
    expect(
      (await prisma.sale.findUnique({ where: { id: sale.body.id } }))!.status,
    ).toBe("DRAFT");
  });

  it("supports walk-in Sales and DRAFT cancellation", async () => {
    await setStock(productId, locationId, 5);
    const walkIn = await createSale(
      [
        {
          productId,
          sourceLocationId: locationId,
          quantity: 1,
          unitPrice: "1",
        },
      ],
      null,
    );
    expect(walkIn.body.customerId).toBeNull();
    expect(walkIn.body.walkIn).toBe(true);
    await request(app.getHttpServer())
      .post(`/sales/${walkIn.body.id}/post`)
      .expect(201);
    const cancelled = await createSale([
      { productId, sourceLocationId: locationId, quantity: 1, unitPrice: "1" },
    ]);
    await request(app.getHttpServer())
      .post(`/sales/${cancelled.body.id}/cancel`)
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe("CANCELLED"));
  });

  it("posts partial Returns as IN, derives net quantity, and rejects over-return", async () => {
    await setStock(productId, locationId, 10);
    const sale = await createSale([
      { productId, sourceLocationId: locationId, quantity: 5, unitPrice: "4" },
    ]);
    await request(app.getHttpServer())
      .post(`/sales/${sale.body.id}/post`)
      .expect(201);
    const draftReturn = await request(app.getHttpServer())
      .post(`/sales/${sale.body.id}/returns`)
      .send({
        reason: "Partial return",
        items: [
          {
            saleItemId: sale.body.items[0].id,
            destinationLocationId: secondLocationId,
            quantityReturned: 2,
          },
        ],
      })
      .expect(201);
    expect(await quantity(productId, secondLocationId)).toBe(0);
    await request(app.getHttpServer())
      .post(`/sale-returns/${draftReturn.body.id}/post`)
      .expect(201);
    expect(await quantity(productId, secondLocationId)).toBe(2);
    const returnDetail = await request(app.getHttpServer())
      .get(`/sale-returns/${draftReturn.body.id}`)
      .expect(200);
    expect(returnDetail.body.inventoryMovements[0]).toMatchObject({
      type: "IN",
      referenceType: "SALE_RETURN",
      referenceItemId: draftReturn.body.items[0].id,
    });
    await request(app.getHttpServer())
      .post(`/sale-returns/${draftReturn.body.id}/post`)
      .expect(409);
    const excessive = await request(app.getHttpServer())
      .post(`/sales/${sale.body.id}/returns`)
      .send({
        reason: "Excessive return",
        items: [
          {
            saleItemId: sale.body.items[0].id,
            destinationLocationId: secondLocationId,
            quantityReturned: 4,
          },
        ],
      })
      .expect(409);
    expect(excessive.body.statusCode).toBe(409);
    const saleDetail = await request(app.getHttpServer())
      .get(`/sales/${sale.body.id}`)
      .expect(200);
    expect(saleDetail.body.items[0]).toMatchObject({
      returnedQuantity: 2,
      netQuantity: 3,
    });
  });

  it("rejects foreign SaleItems and Returns against non-POSTED Sales", async () => {
    await setStock(productId, locationId, 5);
    await setStock(productId, secondLocationId, 5);
    const first = await createSale([
      { productId, sourceLocationId: locationId, quantity: 1, unitPrice: "1" },
    ]);
    const second = await createSale([
      {
        productId,
        sourceLocationId: secondLocationId,
        quantity: 1,
        unitPrice: "1",
      },
    ]);
    await request(app.getHttpServer())
      .post(`/sales/${first.body.id}/post`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/sales/${first.body.id}/returns`)
      .send({
        reason: "Foreign line",
        items: [
          {
            saleItemId: second.body.items[0].id,
            destinationLocationId: locationId,
            quantityReturned: 1,
          },
        ],
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/sales/${second.body.id}/returns`)
      .send({
        reason: "Draft Sale",
        items: [
          {
            saleItemId: second.body.items[0].id,
            destinationLocationId: locationId,
            quantityReturned: 1,
          },
        ],
      })
      .expect(409);
  });

  it("enforces 401, 403, and authorized RBAC outcomes", async () => {
    authenticated = false;
    await request(app.getHttpServer()).get("/customers").expect(401);
    authenticated = true;
    permissions = [];
    await request(app.getHttpServer()).get("/customers").expect(403);
    await request(app.getHttpServer()).post("/sales").send({}).expect(403);
    permissions = [...allPermissions];
    await request(app.getHttpServer()).get("/customers").expect(200);
  });
});
