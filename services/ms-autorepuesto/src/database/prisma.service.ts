import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("PostgreSQL connected");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log("PostgreSQL disconnected");
  }

  async runSerializable<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error: unknown) {
        const retryable = this.isRetryableTransactionError(error);
        if (!retryable) throw error;
        if (attempt === 3)
          throw new ConflictException(
            "Database state changed concurrently; retry the operation",
          );
      }
    }
    throw new ConflictException("Operation could not be serialized");
  }

  private isRetryableTransactionError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (error.code === "P2034") return true;
    if (error.code !== "P2010") return false;
    const databaseCode = (error.meta as { code?: unknown } | undefined)?.code;
    return databaseCode === "40001" || databaseCode === "40P01";
  }
}
