import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

export function throwMappedPrismaError(
  error: unknown,
  conflictMessage = "A record with those values already exists",
): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") throw new ConflictException(conflictMessage);
    if (error.code === "P2003")
      throw new BadRequestException("A referenced record is invalid");
    if (error.code === "P2025") throw new NotFoundException("Record not found");
  }
  throw error;
}
