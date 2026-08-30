import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateVehicleDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  modelId!: string;

  @ApiProperty({ example: 2015, minimum: 1886, maximum: 2100 })
  @IsInt()
  @Min(1886)
  @Max(2100)
  year!: number;

  @ApiProperty({ example: "1.8L" })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  engine!: string;

  @ApiPropertyOptional({ example: "E170" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  generation?: string;

  @ApiPropertyOptional({ example: "LE" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  trim?: string;

  @ApiPropertyOptional({
    example: "9BWZZZ377VT004251",
    maxLength: 64,
    description:
      "Optional chassis VIN; complementary identifier, does not replace model + year + engine",
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  vin?: string;

  @ApiPropertyOptional({
    example: "2ZR-1234567",
    maxLength: 64,
    description: "Optional stamped engine (serial) number; distinct from `engine`",
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  engineNumber?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {}
