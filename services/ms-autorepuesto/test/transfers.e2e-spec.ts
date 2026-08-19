import { randomUUID } from "node:crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common/interfaces";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AutorepuestoAuthGuard } from "../src/auth/guards/autorepuesto-auth.guard";
import { PrismaService } from "../src/database/prisma.service";

describe("Atomic inventory transfers with PostgreSQL", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let categoryId: string;
  let brandId: string;
  let productId: string;
  let sourceId: string;
  let destinationId: string;
  const suffix = `${Date.now()}-transfer`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(AutorepuestoAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            id: "transfer-test-actor",
            roles: [
              {
                permissions: [
                  "inventory.read",
                  "inventory.adjust",
                  "inventory.transfer",
                ],
              },
            ],
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
        data: { code: `transfer-cat-${suffix}`, name: "Transfer category" },
      })
    ).id;
    brandId = (
      await prisma.productBrand.create({
        data: { code: `transfer-brand-${suffix}`, name: "Transfer brand" },
      })
    ).id;
    productId = (
      await prisma.product.create({
        data: {
          code: `TRANSFER-${suffix}`.toUpperCase(),
          name: "Transfer product",
          categoryId,
          brandId,
        },
      })
    ).id;
    sourceId = (
      await prisma.location.create({
        data: { code: `SRC-${suffix}`.toUpperCase(), name: "Source" },
      })
    ).id;
    destinationId = (
      await prisma.location.create({
        data: { code: `DST-${suffix}`.toUpperCase(), name: "Destination" },
      })
    ).id;
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "INITIAL",
        productId,
        destinationLocationId: sourceId,
        quantity: 10,
      })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.inventoryMovement.deleteMany({ where: { productId } });
    await prisma.inventory.deleteMany({ where: { productId } });
    await prisma.location.deleteMany({
      where: { id: { in: [sourceId, destinationId] } },
    });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.productBrand.deleteMany({ where: { id: brandId } });
    await prisma.productCategory.deleteMany({ where: { id: categoryId } });
    await app.close();
  });

  async function quantity(locationId: string): Promise<number> {
    const row = await prisma.inventory.findUnique({
      where: { productId_locationId: { productId, locationId } },
    });
    return row?.quantity ?? 0;
  }

  it("atomically transfers stock and preserves the product total", async () => {
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "TRANSFER",
        productId,
        sourceLocationId: sourceId,
        destinationLocationId: destinationId,
        quantity: 3,
      })
      .expect(201)
      .expect((response) =>
        expect(response.body).toMatchObject({
          sourceQuantityBefore: 10,
          sourceQuantityAfter: 7,
          destinationQuantityBefore: 0,
          destinationQuantityAfter: 3,
        }),
      );
    expect(await quantity(sourceId)).toBe(7);
    expect(await quantity(destinationId)).toBe(3);
  });

  it("rejects an insufficient transfer and rolls back every change", async () => {
    const movementCount = await prisma.inventoryMovement.count({
      where: { productId },
    });
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "TRANSFER",
        productId,
        sourceLocationId: sourceId,
        destinationLocationId: destinationId,
        quantity: 99,
      })
      .expect(409);
    expect(await quantity(sourceId)).toBe(7);
    expect(await quantity(destinationId)).toBe(3);
    expect(await prisma.inventoryMovement.count({ where: { productId } })).toBe(
      movementCount,
    );
  });

  it("rejects same-location and invalid-location transfers", async () => {
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "TRANSFER",
        productId,
        sourceLocationId: sourceId,
        destinationLocationId: sourceId,
        quantity: 1,
      })
      .expect(400);
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "TRANSFER",
        productId,
        sourceLocationId: randomUUID(),
        destinationLocationId: destinationId,
        quantity: 1,
      })
      .expect(404);
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "TRANSFER",
        productId,
        sourceLocationId: sourceId,
        destinationLocationId: randomUUID(),
        quantity: 1,
      })
      .expect(404);
    expect(await quantity(sourceId)).toBe(7);
    expect(await quantity(destinationId)).toBe(3);
  });

  it("prevents concurrent OUT commands from producing negative stock", async () => {
    await request(app.getHttpServer())
      .post("/inventory/movements")
      .send({
        type: "ADJUSTMENT",
        productId,
        destinationLocationId: sourceId,
        quantity: 5,
        reason: "Prepare concurrency test",
      })
      .expect(201);
    const command = () =>
      request(app.getHttpServer())
        .post("/inventory/movements")
        .send({
          type: "OUT",
          productId,
          sourceLocationId: sourceId,
          quantity: 4,
        });
    const responses = await Promise.all([command(), command()]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(await quantity(sourceId)).toBe(1);
    expect(await quantity(destinationId)).toBe(3);
  });
});
