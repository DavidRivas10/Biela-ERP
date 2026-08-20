import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CashMovementType } from "@prisma/client";
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

const MONEY = /^(0|[1-9]\d{0,15})(\.\d{1,2})?$/;
const POSITIVE_MONEY = /^(?=.*[1-9])(0|[1-9]\d{0,15})(\.\d{1,2})?$/;

export class OpenCashSessionDto {
  @ApiProperty({ example: "1000.00" })
  @IsString()
  @Matches(MONEY)
  openingAmount!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CloseCashSessionDto {
  @ApiProperty({ example: "1250.00" })
  @IsString()
  @Matches(MONEY)
  countedAmount!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateManualCashMovementDto {
  @ApiProperty({
    enum: [CashMovementType.MANUAL_IN, CashMovementType.MANUAL_OUT],
  })
  @IsIn([CashMovementType.MANUAL_IN, CashMovementType.MANUAL_OUT])
  type!: CashMovementType;

  @ApiProperty({ example: "100.00" })
  @IsString()
  @Matches(POSITIVE_MONEY)
  amount!: string;

  @ApiProperty({ example: "Petty cash replenishment" })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
