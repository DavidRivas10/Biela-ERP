import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AuthController } from "../src/auth/auth.controller";
import { HealthController } from "../src/health/health.controller";
import { UpstreamService } from "../src/upstream/upstream.service";

describe("API Gateway HTTP", () => {
  let app: INestApplication;
  const upstream = { request: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController, HealthController],
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
});
