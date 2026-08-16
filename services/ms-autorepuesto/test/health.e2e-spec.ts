import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { PrismaService } from "../src/database/prisma.service";
import { HealthController } from "../src/health/health.controller";
import { HealthService } from "../src/health/health.service";

describe("ms-autorepuesto health HTTP", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: { $queryRaw: jest.fn().mockResolvedValue([{ one: 1 }]) },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());

  it("GET /health queries PostgreSQL and returns healthy", () =>
    request(app.getHttpServer()).get("/health").expect(200, {
      status: "ok",
      service: "ms-autorepuesto",
      database: "connected",
    }));
});
