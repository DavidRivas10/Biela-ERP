import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AuthController } from "../src/auth/auth.controller";
import { AuthService } from "../src/auth/auth.service";
import { JwtAuthGuard } from "../src/auth/guards/jwt-auth.guard";

describe("ms-users authentication HTTP", () => {
  let app: INestApplication;
  const authService = { login: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());

  it("POST /auth/login returns a token response", async () => {
    authService.login.mockResolvedValue({
      accessToken: "test-token",
      tokenType: "Bearer",
    });
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "admin@example.com", password: "test-password" })
      .expect(200)
      .expect({ accessToken: "test-token", tokenType: "Bearer" });
  });
});
