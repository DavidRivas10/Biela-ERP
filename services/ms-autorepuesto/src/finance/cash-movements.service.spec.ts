import { CashMovementType } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { CashMovementsService } from "./cash-movements.service";

describe("CashMovementsService", () => {
  it("uses deterministic bounded pagination and relational filters in two fixed queries", async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: "movement-2" }]);
    const count = jest.fn().mockResolvedValue(41);
    const prisma = {
      cashMovement: { findMany, count },
    } as unknown as PrismaService;
    const service = new CashMovementsService(prisma);

    const result = await service.findAll({
      page: 3,
      limit: 20,
      cashSessionId: "13239211-2c92-4f78-8b77-61c23e245e0d",
      cashRegisterId: "8e47df9d-019f-47ac-a99a-da4f01e09974",
      type: CashMovementType.MANUAL_IN,
      reference: "101",
      createdFrom: new Date("2026-08-01T00:00:00.000Z"),
      createdTo: new Date("2026-08-31T23:59:59.999Z"),
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 40,
        take: 20,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          cashSession: { include: { cashRegister: true } },
          payment: { include: { paymentMethod: true } },
        },
        where: expect.objectContaining({
          cashSessionId: "13239211-2c92-4f78-8b77-61c23e245e0d",
          type: CashMovementType.MANUAL_IN,
          cashSession: {
            cashRegisterId: "8e47df9d-019f-47ac-a99a-da4f01e09974",
          },
          payment: { is: { OR: expect.arrayContaining([{ number: 101 }]) } },
        }),
      }),
    );
    expect(count).toHaveBeenCalledTimes(1);
    expect(result.meta).toEqual({
      page: 3,
      limit: 20,
      total: 41,
      pages: 3,
    });
  });
});
