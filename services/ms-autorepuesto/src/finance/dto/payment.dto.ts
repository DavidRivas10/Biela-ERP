import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

const POSITIVE_MONEY = /^(?=.*[1-9])(0|[1-9]\d{0,15})(\.\d{1,2})?$/;

export class CreateSalePaymentDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  paymentMethodId!: string;

  @ApiProperty({ example: "250.00" })
  @IsString()
  @Matches(POSITIVE_MONEY)
  amount!: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  cashSessionId?: string;

  @ApiPropertyOptional({ example: "300.00" })
  @IsOptional()
  @IsString()
  @Matches(POSITIVE_MONEY)
  tenderedAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  externalReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateSaleRefundDto extends CreateSalePaymentDto {}

export class ReversePaymentDto {
  @ApiProperty({ example: "Duplicate operation" })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  cashSessionId?: string;
}
