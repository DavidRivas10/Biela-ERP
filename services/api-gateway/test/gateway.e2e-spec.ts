import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AuthController } from "../src/auth/auth.controller";
import { HealthController } from "../src/health/health.controller";
import { ProductsController } from "../src/catalog/products.controller";
import { VehiclesController } from "../src/catalog/vehicles.controller";
import { CompatibilitiesController } from "../src/catalog/compatibilities.controller";
import { UpstreamService } from "../src/upstream/upstream.service";

describe("API Gateway HTTP", () => {
  let app: INestApplication;
  const upstream = { request: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        AuthController,
        HealthController,
        ProductsController,
        VehiclesController,
        CompatibilitiesController,
      ],
      providers: [{ provide: UpstreamService, useValue: upstream }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());
  beforeEach(() => upstream.request.mockReset());

  it("GET /health returns gateway health", () =>
    request(app.getHttpServer()).get("/health").expect(200, {
      status: "ok",
      service: "api-gateway",
    }));

  it("POST /api/auth/login forwards and returns authentication data", async () => {
    upstream.request.mockResolvedValue({
      accessToken: "test-token",
      tokenType: "Bearer",
    });
    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "test-password" })
      .expect(200)
      .expect({ accessToken: "test-token", tokenType: "Bearer" });
    expect(upstream.request).toHaveBeenCalledWith(
      "users",
      expect.objectContaining({ method: "POST", path: "auth/login" }),
    );
  });

  it("forwards Phase 2 product requests and bearer authorization", async () => {
    upstream.request.mockResolvedValue({ id: "product-id", code: "BP-001" });
    await request(app.getHttpServer())
      .post("/api/products")
      .set("Authorization", "Bearer catalog-token")
      .send({
        code: "BP-001",
        name: "Brake Pad",
        categoryId: "c",
        brandId: "b",
      })
      .expect(201);
    expect(upstream.request).toHaveBeenCalledWith("autorepuesto", {
      method: "POST",
      path: "products",
      authorization: "Bearer catalog-token",
      body: expect.objectContaining({ code: "BP-001" }),
    });
  });

  it("forwards nested compatibility queries with pagination", async () => {
    upstream.request.mockResolvedValue({ data: [], meta: { page: 1 } });
    await request(app.getHttpServer())
      .get("/api/products/product-id/vehicles?page=1&limit=20")
      .set("Authorization", "Bearer catalog-token")
      .expect(200);
    expect(upstream.request).toHaveBeenCalledWith("autorepuesto", {
      path: "products/product-id/vehicles",
      authorization: "Bearer catalog-token",
      query: expect.objectContaining({ page: "1", limit: "20" }),
    });
  });
});
