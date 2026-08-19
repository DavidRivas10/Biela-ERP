import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateLocationDto {
  @ApiProperty({ example: "WH-A-01-R02-S03-B04" })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9._/-]*$/)
  @MinLength(2)
  @MaxLength(60)
  code!: string;

  @ApiProperty({ example: "Brake parts bin" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: "Front counter fast-moving stock" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: "Warehouse A" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  zone?: string;

  @ApiPropertyOptional({ example: "01" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  aisle?: string;

  @ApiPropertyOptional({ example: "R02" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  rack?: string;

  @ApiPropertyOptional({ example: "S03" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  shelf?: string;

  @ApiPropertyOptional({ example: "B04" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  bin?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateLocationDto extends PartialType(CreateLocationDto) {}
