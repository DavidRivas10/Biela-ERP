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
  Min,
  ValidateNested,
} from "class-validator";

export class CreatePurchaseItemDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  productId!: string;

  @ApiProperty({ minimum: 1, example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderedQuantity!: number;

  @ApiProperty({ type: String, example: "12.3456" })
  @IsDecimal({ decimal_digits: "0,4", force_decimal: false })
  unitCost!: string;

  @ApiPropertyOptional({ type: String, default: "0.00" })
  @IsOptional()
  @IsDecimal({ decimal_digits: "0,2", force_decimal: false })
  discountAmount?: string;

  @ApiPropertyOptional({ type: String, default: "0.00" })
  @IsOptional()
  @IsDecimal({ decimal_digits: "0,2", force_decimal: false })
  taxAmount?: string;
}

export class CreatePurchaseDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  supplierId!: string;

  @ApiPropertyOptional({ example: "INV-2026-001" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  supplierDocumentNumber?: string;

  @ApiProperty({ type: String, format: "date", example: "2026-08-19" })
  @IsDateString({ strict: true })
  documentDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ type: [CreatePurchaseItemDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items!: CreatePurchaseItemDto[];
}

export class UpdatePurchaseDto extends PartialType(CreatePurchaseDto) {}
