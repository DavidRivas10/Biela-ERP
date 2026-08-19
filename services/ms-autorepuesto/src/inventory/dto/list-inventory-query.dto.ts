import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { booleanQueryTransform } from "../../common/validation/boolean-query.transform";

export class ListInventoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: "Only positive or zero balances",
  })
  @IsOptional()
  @Transform(booleanQueryTransform)
  @IsBoolean()
  inStock?: boolean;
}
