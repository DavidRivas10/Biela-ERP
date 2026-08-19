import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { booleanQueryTransform } from "../../common/validation/boolean-query.transform";

export class ListLocationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Normalized location-code filter" })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MaxLength(60)
  code?: string;

  @ApiPropertyOptional({
    description: "Search code, name, zone, or description",
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(booleanQueryTransform)
  @IsBoolean()
  active?: boolean;
}
