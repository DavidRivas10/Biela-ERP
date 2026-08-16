import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

export class ProductAttributeInputDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  definitionId!: string;

  @ApiProperty({ example: "ceramic" })
  @IsString()
  @MinLength(1)
  @MaxLength(250)
  value!: string;
}

export class CreateProductDto {
  @ApiProperty({ example: "BP-TOY-001" })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9._/-]*$/)
  @MinLength(2)
  @MaxLength(80)
  code!: string;

  @ApiProperty({ example: "Brake Pad" })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  brandId!: string;

  @ApiPropertyOptional({ type: [ProductAttributeInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayUnique((attribute: ProductAttributeInputDto) => attribute.definitionId)
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeInputDto)
  attributes?: ProductAttributeInputDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}
