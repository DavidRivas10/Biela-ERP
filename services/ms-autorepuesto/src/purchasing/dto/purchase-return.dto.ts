import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class CreatePurchaseReturnItemDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  purchaseItemId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  sourceLocationId!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantityReturned!: number;
}

export class CreatePurchaseReturnDto {
  @ApiProperty({ example: "Damaged merchandise returned to supplier" })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @ApiProperty({ type: [CreatePurchaseReturnItemDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseReturnItemDto)
  items!: CreatePurchaseReturnItemDto[];
}
