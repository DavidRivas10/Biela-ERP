import { ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { HealthService } from "./health.service";

describe("HealthService", () => {
  it("reports healthy when PostgreSQL answers a query", async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
    };
    const service = new HealthService(prisma as unknown as PrismaService);
    await expect(service.check()).resolves.toEqual({
      status: "ok",
      service: "ms-autorepuesto",
      database: "connected",
    });
  });

  it("reports unavailable when PostgreSQL cannot be queried", async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error("connection refused")),
    };
    const service = new HealthService(prisma as unknown as PrismaService);
    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
