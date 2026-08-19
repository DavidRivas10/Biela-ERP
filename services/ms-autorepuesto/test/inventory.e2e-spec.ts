import { randomUUID } from "node:crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common/interfaces";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AutorepuestoAuthGuard } from "../src/auth/guards/autorepuesto-auth.guard";
import { PrismaService } from "../src/database/prisma.service";

describe("Inventory HTTP with PostgreSQL", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let categoryId: string;
  let brandId: string;
  let productId: string;
  let locationId: string;
  let inventoryId: string;
  let permissions = [
    "inventory.read",
    "inventory.adjust",
    "inventory.transfer",
  ];
  const suffix = Date.now().toString();

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(AutorepuestoAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            id: "inventory-test-actor",
            email: "inventory@example.com",
            active: true,
            roles: [{ id: "role", name: "inventory", permissions }],
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
    const category = await prisma.productCategory.create({
      data: { code: `inv-cat-${suffix}`, name: "Inventory test category" },
    });
    categoryId = category.id;
    const brand = await prisma.productBrand.create({
      data: { code: `inv-brand-${suffix}`, name: "Inventory test brand" },
    });
    brandId = brand.id;
    const product = await prisma.product.create({
      data: {
        code: `INV-${suffix}`,
        name: "Inventory test product",
        categoryId,
        brandId,
      },
    });
    productId = product.id;
    const location = await prisma.location.create({
      data: { code: `INV-LOC-${suffix}`, name: "Inventory location" },
    });
    locationId = location.id;
  });

  afterAll(async () => {
    await prisma.inventoryMovement.deleteMany({ where: { productId } });
    await prisma.inventory.deleteMany({ where: { productId } });
    await prisma.location.deleteMany({ where: { id: locationId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.productBrand.deleteMany({ where: { id: brandId } });
    await prisma.productCategory.deleteMany({ where: { id: categoryId } });
    await app.close();
  });

  beforeEach(() => {
    permissions = ["inventory.read", "inventory.adjust", "inventory.transfer"];
  });

  it("enforces movement authorization", () => {
    permissions = ["inventory.read"];
    return request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "IN",
        productId,
        destinationLocationId: locationId,
        quantity: 1,
      })
      .expect(403);
  });

  it("enforces inventory read authorization", () => {
    permissions = ["inventory.adjust"];
    return request(app.getHttpServer()).get("/inventory").expect(403);
  });

  it("rejects invalid movement DTOs and shapes", async () => {
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "IN",
        productId,
        sourceLocationId: locationId,
        quantity: 1,
      })
      .expect(400);
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "OUT",
        productId,
        sourceLocationId: locationId,
        quantity: 0,
      })
      .expect(400);
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "ADJUSTMENT",
        productId,
        destinationLocationId: locationId,
        quantity: 0,
      })
      .expect(400);
  });

  it("rejects invalid product and location references", async () => {
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "INITIAL",
        productId: randomUUID(),
        destinationLocationId: locationId,
        quantity: 10,
      })
      .expect(404);
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "INITIAL",
        productId,
        destinationLocationId: randomUUID(),
        quantity: 10,
      })
      .expect(404);
  });

  it("creates a traceable INITIAL balance", async () => {
    const response = await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "INITIAL",
        productId,
        destinationLocationId: locationId,
        quantity: 10,
        reason: "Opening count",
      })
      .expect(201);
    expect(response.body).toMatchObject({
      type: "INITIAL",
      quantity: 10,
      actorId: "inventory-test-actor",
      destinationQuantityBefore: 0,
      destinationQuantityAfter: 10,
    });
    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { productId_locationId: { productId, locationId } },
    });
    inventoryId = inventory.id;
  });

  it("rejects duplicate INITIAL without changing stock", async () => {
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "INITIAL",
        productId,
        destinationLocationId: locationId,
        quantity: 5,
      })
      .expect(409);
    const balance = await prisma.inventory.findUniqueOrThrow({
      where: { productId_locationId: { productId, locationId } },
    });
    expect(balance.quantity).toBe(10);
  });

  it("queries inventory by id, product, location, and total", async () => {
    await request(app.getHttpServer())
      .get(`/inventory/${inventoryId}`)
      .expect(200)
      .expect((response) => expect(response.body.quantity).toBe(10));
    await request(app.getHttpServer())
      .get(`/products/${productId}/inventory`)
      .query({ page: 1, limit: 1, inStock: true })
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toHaveLength(1);
        expect(response.body.totalQuantity).toBe(10);
        expect(response.body.meta).toMatchObject({ page: 1, limit: 1 });
      });
    await request(app.getHttpServer())
      .get(`/locations/${locationId}/inventory`)
      .expect(200)
      .expect((response) =>
        expect(response.body.data[0].productId).toBe(productId),
      );
  });

  it("applies IN and OUT with before/after audit balances", async () => {
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "IN",
        productId,
        destinationLocationId: locationId,
        quantity: 5,
      })
      .expect(201)
      .expect((response) =>
        expect(response.body).toMatchObject({
          destinationQuantityBefore: 10,
          destinationQuantityAfter: 15,
        }),
      );
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "OUT",
        productId,
        sourceLocationId: locationId,
        quantity: 4,
      })
      .expect(201)
      .expect((response) =>
        expect(response.body).toMatchObject({
          sourceQuantityBefore: 15,
          sourceQuantityAfter: 11,
        }),
      );
  });

  it("rejects insufficient OUT and preserves the balance and ledger", async () => {
    const beforeMovements = await prisma.inventoryMovement.count({
      where: { productId },
    });
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "OUT",
        productId,
        sourceLocationId: locationId,
        quantity: 99,
      })
      .expect(409);
    const balance = await prisma.inventory.findUniqueOrThrow({
      where: { productId_locationId: { productId, locationId } },
    });
    expect(balance.quantity).toBe(11);
    expect(await prisma.inventoryMovement.count({ where: { productId } })).toBe(
      beforeMovements,
    );
  });

  it("applies target-quantity ADJUSTMENT and requires active entities", async () => {
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "ADJUSTMENT",
        productId,
        destinationLocationId: locationId,
        quantity: 8,
        reason: "Verified cycle count",
      })
      .expect(201)
      .expect((response) =>
        expect(response.body).toMatchObject({
          destinationQuantityBefore: 11,
          destinationQuantityAfter: 8,
        }),
      );
    await prisma.location.update({
      where: { id: locationId },
      data: { active: false },
    });
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "IN",
        productId,
        destinationLocationId: locationId,
        quantity: 1,
      })
      .expect(404);
    await prisma.location.update({
      where: { id: locationId },
      data: { active: true },
    });
    await prisma.product.update({
      where: { id: productId },
      data: { active: false },
    });
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "IN",
        productId,
        destinationLocationId: locationId,
        quantity: 1,
      })
      .expect(404);
    await prisma.product.update({
      where: { id: productId },
      data: { active: true },
    });
  });

  it("lists movement history with filters and pagination", () =>
    request(app.getHttpServer())
      .get("/inventory/movements")
      .query({ productId, locationId, type: "OUT", page: 1, limit: 1 })
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].type).toBe("OUT");
        expect(response.body.meta.total).toBe(1);
      }));

  it("PostgreSQL rejects direct negative balances", async () => {
    await expect(
      prisma.inventory.update({
        where: { id: inventoryId },
        data: { quantity: -1 },
      }),
    ).rejects.toBeDefined();
  });
});
