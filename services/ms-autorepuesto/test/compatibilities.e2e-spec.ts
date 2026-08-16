import { randomUUID } from "node:crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AutorepuestoAuthGuard } from "../src/auth/guards/autorepuesto-auth.guard";
import { BusinessPermissionsGuard } from "../src/auth/guards/business-permissions.guard";
import { PrismaService } from "../src/database/prisma.service";

describe("Compatibility HTTP with PostgreSQL", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const ids: Record<string, string> = {};
  const suffix = Date.now().toString();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(AutorepuestoAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(BusinessPermissionsGuard)
      .useValue({ canActivate: () => true })
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

    ids.category = (
      await prisma.productCategory.create({
        data: {
          code: `compat-category-${suffix}`,
          name: "Compatibility Category",
        },
      })
    ).id;
    ids.productBrand = (
      await prisma.productBrand.create({
        data: {
          code: `compat-product-brand-${suffix}`,
          name: "Compatibility Product Brand",
        },
      })
    ).id;
    ids.product = (
      await prisma.product.create({
        data: {
          code: `COMPAT-${suffix}`,
          name: "Brake Pad",
          categoryId: ids.category,
          brandId: ids.productBrand,
        },
      })
    ).id;
    ids.vehicleBrand = (
      await prisma.vehicleBrand.create({
        data: { code: `compat-toyota-${suffix}`, name: "Toyota" },
      })
    ).id;
    ids.vehicleModel = (
      await prisma.vehicleModel.create({
        data: {
          brandId: ids.vehicleBrand,
          code: `compat-corolla-${suffix}`,
          name: "Corolla",
        },
      })
    ).id;
    ids.vehicle = (
      await prisma.vehicle.create({
        data: { modelId: ids.vehicleModel, year: 2015, engine: "1.8L" },
      })
    ).id;
  });

  afterAll(async () => {
    if (ids.compatibility) {
      await prisma.productCompatibility.deleteMany({
        where: { id: ids.compatibility },
      });
    }
    await prisma.product.deleteMany({ where: { id: ids.product } });
    await prisma.productBrand.deleteMany({ where: { id: ids.productBrand } });
    await prisma.productCategory.deleteMany({ where: { id: ids.category } });
    await prisma.vehicle.deleteMany({ where: { id: ids.vehicle } });
    await prisma.vehicleModel.deleteMany({ where: { id: ids.vehicleModel } });
    await prisma.vehicleBrand.deleteMany({ where: { id: ids.vehicleBrand } });
    await app.close();
  });

  it("rejects nonexistent products and vehicles", async () => {
    await request(app.getHttpServer())
      .post("/compatibilities")
      .send({ productId: randomUUID(), vehicleId: ids.vehicle })
      .expect(404);
    await request(app.getHttpServer())
      .post("/compatibilities")
      .send({ productId: ids.product, vehicleId: randomUUID() })
      .expect(404);
  });

  it("creates an explicit Product-to-Vehicle compatibility", async () => {
    const response = await request(app.getHttpServer())
      .post("/compatibilities")
      .send({
        productId: ids.product,
        vehicleId: ids.vehicle,
        notes: "Direct fit",
      })
      .expect(201);
    ids.compatibility = response.body.id as string;
    expect(response.body).toMatchObject({
      productId: ids.product,
      vehicleId: ids.vehicle,
      active: true,
    });
  });

  it("rejects the same product and vehicle pair with a clean conflict", () =>
    request(app.getHttpServer())
      .post("/compatibilities")
      .send({ productId: ids.product, vehicleId: ids.vehicle })
      .expect(409));

  it("gets and lists the compatibility with pagination", async () => {
    await request(app.getHttpServer())
      .get(`/compatibilities/${ids.compatibility}`)
      .expect(200)
      .expect((response) => expect(response.body.id).toBe(ids.compatibility));
    await request(app.getHttpServer())
      .get("/compatibilities")
      .query({
        productId: ids.product,
        vehicleId: ids.vehicle,
        page: 1,
        limit: 1,
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.data[0].id).toBe(ids.compatibility);
        expect(response.body.meta).toMatchObject({
          page: 1,
          limit: 1,
          total: 1,
        });
      });
  });

  it("returns compatible vehicles and products in both directions", async () => {
    await request(app.getHttpServer())
      .get(`/products/${ids.product}/vehicles`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data[0].id).toBe(ids.vehicle);
        expect(response.body.data[0].compatibility.id).toBe(ids.compatibility);
      });
    await request(app.getHttpServer())
      .get(`/vehicles/${ids.vehicle}/products`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data[0].id).toBe(ids.product);
        expect(response.body.data[0].compatibility.id).toBe(ids.compatibility);
      });
  });

  it("updates metadata and deactivates without deleting the relation", async () => {
    await request(app.getHttpServer())
      .patch(`/compatibilities/${ids.compatibility}`)
      .send({ notes: "Fitment verified", active: false })
      .expect(200)
      .expect((response) => {
        expect(response.body.notes).toBe("Fitment verified");
        expect(response.body.active).toBe(false);
      });
    await request(app.getHttpServer())
      .get(`/products/${ids.product}/vehicles`)
      .expect(200)
      .expect((response) => expect(response.body.data).toHaveLength(0));
  });
});
