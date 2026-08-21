import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";
import { booleanQueryTransform } from "../../common/validation/boolean-query.transform";

export class CashSessionSummaryQueryDto {
  @ApiPropertyOptional({
    default: true,
    description:
      "Set to false to retain summary fields without embedding the movement ledger",
  })
  @IsOptional()
  @Transform(booleanQueryTransform)
  @IsBoolean()
  includeMovements = true;
}
