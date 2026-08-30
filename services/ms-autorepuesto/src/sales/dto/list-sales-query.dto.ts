import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from "class-validator";
import { SaleStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { booleanQueryTransform } from "../../common/validation/boolean-query.transform";

export class ListSalesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  number?: number;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ enum: SaleStatus })
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      "When true, only Sales that carry an open-account label; when false, only those without one.",
  })
  @IsOptional()
  @Transform(booleanQueryTransform)
  @IsBoolean()
  hasAccountLabel?: boolean;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ format: "date" })
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({ format: "date" })
  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}
