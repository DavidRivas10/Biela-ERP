import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common/interfaces";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AutorepuestoAuthGuard } from "../src/auth/guards/autorepuesto-auth.guard";
import { PrismaService } from "../src/database/prisma.service";

describe("Deterministic product search with PostgreSQL", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let categoryId: string;
  let productBrandId: string;
  let firstProductId: string;
  let secondProductId: string;
  let inactiveProductId: string;
  let vehicleBrandId: string;
  let vehicleModelId: string;
  let vehicleId: string;
  let locationId: string;
  let permissions = ["search.read"];
  const suffix = Date.now().toString();
  const exactCode = `SRCH-${suffix}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(AutorepuestoAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            id: "search-test-user",
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
        data: { code: `search-cat-${suffix}`, name: "Search category" },
      })
    ).id;
    productBrandId = (
      await prisma.productBrand.create({
        data: { code: `search-brand-${suffix}`, name: "Search brand" },
      })
    ).id;
    firstProductId = (
      await prisma.product.create({
        data: {
          code: exactCode,
          name: "Premium Brake Pad",
          categoryId,
          brandId: productBrandId,
        },
      })
    ).id;
    secondProductId = (
      await prisma.product.create({
        data: {
          code: `${exactCode}-ALT`,
          name: "Alternative Oil Filter",
          categoryId,
          brandId: productBrandId,
        },
      })
    ).id;
    inactiveProductId = (
      await prisma.product.create({
        data: {
          code: `${exactCode}-INACTIVE`,
          name: "Inactive Search Product",
          categoryId,
          brandId: productBrandId,
          active: false,
        },
      })
    ).id;
    vehicleBrandId = (
      await prisma.vehicleBrand.create({
        data: { code: `search-toyota-${suffix}`, name: "Toyota" },
      })
    ).id;
    vehicleModelId = (
      await prisma.vehicleModel.create({
        data: {
          brandId: vehicleBrandId,
          code: `search-corolla-${suffix}`,
          name: "Corolla",
        },
      })
    ).id;
    vehicleId = (
      await prisma.vehicle.create({
        data: {
          modelId: vehicleModelId,
          year: 2015,
          engine: "1.8L",
          generation: "E170",
          trim: "LE",
        },
      })
    ).id;
    await prisma.productCompatibility.create({
      data: { productId: firstProductId, vehicleId },
    });
    locationId = (
      await prisma.location.create({
        data: { code: `SEARCH-LOC-${suffix}`, name: "Search stock" },
      })
    ).id;
    await prisma.inventory.create({
      data: { productId: firstProductId, locationId, quantity: 5 },
    });
  });

  afterAll(async () => {
    await prisma.inventory.deleteMany({ where: { productId: firstProductId } });
    await prisma.productCompatibility.deleteMany({ where: { vehicleId } });
    await prisma.location.deleteMany({ where: { id: locationId } });
    await prisma.product.deleteMany({
      where: {
        id: { in: [firstProductId, secondProductId, inactiveProductId] },
      },
    });
    await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
    await prisma.vehicleModel.deleteMany({ where: { id: vehicleModelId } });
    await prisma.vehicleBrand.deleteMany({ where: { id: vehicleBrandId } });
    await prisma.productBrand.deleteMany({ where: { id: productBrandId } });
    await prisma.productCategory.deleteMany({ where: { id: categoryId } });
    await app.close();
  });

  beforeEach(() => {
    permissions = ["search.read"];
  });

  it("enforces search authorization", () => {
    permissions = [];
    return request(app.getHttpServer()).get("/search/products").expect(403);
  });

  it("ranks an exact normalized product code before partial matches", () =>
    request(app.getHttpServer())
      .get("/search/products")
      .query({ q: exactCode.toLowerCase() })
      .expect(200)
      .expect((response) => {
        expect(response.body.data[0].id).toBe(firstProductId);
        expect(response.body.data[0].totalStock).toBe(5);
        expect(response.body.meta.total).toBe(2);
      }));

  it("searches partial product codes with stable pagination", async () => {
    const first = await request(app.getHttpServer())
      .get("/search/products")
      .query({ q: `SRCH-${suffix.slice(0, 6)}`, page: 1, limit: 2 })
      .expect(200);
    const repeated = await request(app.getHttpServer())
      .get("/search/products")
      .query({ q: `SRCH-${suffix.slice(0, 6)}`, page: 1, limit: 2 })
      .expect(200);
    expect(
      first.body.data.map((product: { id: string }) => product.id),
    ).toEqual(repeated.body.data.map((product: { id: string }) => product.id));
    expect(first.body.meta).toMatchObject({ page: 1, limit: 2, total: 2 });
  });

  it("searches product names case-insensitively", async () => {
    await request(app.getHttpServer())
      .get("/search/products")
      .query({ q: "premium brake" })
      .expect(200)
      .expect((response) =>
        expect(response.body.data[0].id).toBe(firstProductId),
      );
    await request(app.getHttpServer())
      .get("/search/products")
      .query({ q: "PREMIUM BRAKE" })
      .expect(200)
      .expect((response) =>
        expect(response.body.data[0].id).toBe(firstProductId),
      );
  });

  it("searches through explicit vehicle compatibility and year", () =>
    request(app.getHttpServer())
      .get("/search/products")
      .query({
        vehicleBrandId,
        vehicleModelId,
        year: 2015,
        engine: "1.8",
        generation: "e170",
        trim: "le",
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBe(firstProductId);
        expect(response.body.data[0].matchingVehicles[0].id).toBe(vehicleId);
      }));

  it("supports direct vehicle compatibility lookup", () =>
    request(app.getHttpServer())
      .get("/search/products")
      .query({ vehicleId })
      .expect(200)
      .expect((response) =>
        expect(response.body.data[0].id).toBe(firstProductId),
      ));

  it("filters by stock, category, and product brand", () =>
    request(app.getHttpServer())
      .get("/search/products")
      .query({
        q: exactCode,
        inStock: true,
        categoryId,
        brandId: productBrandId,
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBe(firstProductId);
      }));

  it("hides inactive products by default and can query them explicitly", async () => {
    await request(app.getHttpServer())
      .get("/search/products")
      .query({ q: `${exactCode}-INACTIVE` })
      .expect(200)
      .expect((response) => expect(response.body.data).toHaveLength(0));
    await request(app.getHttpServer())
      .get("/search/products")
      .query({ q: `${exactCode}-INACTIVE`, active: false })
      .expect(200)
      .expect((response) =>
        expect(response.body.data[0].id).toBe(inactiveProductId),
      );
  });

  it("returns an empty paginated result for no matches", () =>
    request(app.getHttpServer())
      .get("/search/products")
      .query({ q: `NO-MATCH-${suffix}` })
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toEqual([]);
        expect(response.body.meta).toMatchObject({ total: 0, pages: 0 });
      }));
});
