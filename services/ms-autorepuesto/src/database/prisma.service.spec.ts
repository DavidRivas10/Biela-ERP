import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service";

describe("PrismaService serializable transactions", () => {
  it("retries PostgreSQL 40001 surfaced by a raw locking query", async () => {
    const service = new PrismaService();
    const serializationFailure = new Prisma.PrismaClientKnownRequestError(
      "could not serialize access due to concurrent update",
      {
        code: "P2010",
        clientVersion: "test",
        meta: { code: "40001" },
      },
    );
    const transaction = jest
      .spyOn(service, "$transaction")
      .mockRejectedValueOnce(serializationFailure)
      .mockResolvedValueOnce("committed" as never);

    await expect(
      service.runSerializable(async () => "committed"),
    ).resolves.toBe("committed");
    expect(transaction).toHaveBeenCalledTimes(2);
  });
});
