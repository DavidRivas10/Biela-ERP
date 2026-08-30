import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsDecimal,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";

export class CreateSaleItemDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  productId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  sourceLocationId!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    type: String,
    example: "125.5000",
    description: "Defaults to Product.defaultSalePrice and is snapshotted",
  })
  @IsOptional()
  @IsDecimal({ decimal_digits: "0,4", force_decimal: false })
  @Matches(/^\d+(?:\.\d{1,4})?$/)
  unitPrice?: string;

  @ApiPropertyOptional({ type: String, default: "0.00" })
  @IsOptional()
  @IsDecimal({ decimal_digits: "0,2", force_decimal: false })
  @Matches(/^\d+(?:\.\d{1,2})?$/)
  discountAmount?: string;

  @ApiPropertyOptional({ type: String, default: "0.00" })
  @IsOptional()
  @IsDecimal({ decimal_digits: "0,2", force_decimal: false })
  @Matches(/^\d+(?:\.\d{1,2})?$/)
  taxAmount?: string;
}

export class CreateSaleDto {
  @ApiPropertyOptional({
    format: "uuid",
    nullable: true,
    description: "Omit or use null for a walk-in Sale",
  })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  customerId?: string | null;

  @ApiPropertyOptional({
    type: String,
    maxLength: 120,
    description:
      'Free-text label for an open counter account (cuenta abierta), e.g. "Corolla azul - Juan". Optional; a plain walk-in or registered Sale omits it.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  accountLabel?: string;

  @ApiProperty({ type: String, format: "date", example: "2026-08-19" })
  @IsDateString({ strict: true })
  documentDate!: string;

  @ApiPropertyOptional({
    type: String,
    format: "date",
    description: "Optional financial due date; it does not affect posting",
  })
  @IsOptional()
  @IsDateString({ strict: true })
  paymentDueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ type: [CreateSaleItemDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];
}

export class UpdateSaleDto extends PartialType(CreateSaleDto) {}
