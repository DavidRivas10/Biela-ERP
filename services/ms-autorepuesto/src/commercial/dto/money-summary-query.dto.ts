import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";

export class MoneySummaryQueryDto {
  /** Defaults to today (business date) when omitted. */
  @ApiPropertyOptional({ format: "date" })
  @IsOptional()
  @IsDateString({ strict: true })
  dateFrom?: string;

  @ApiPropertyOptional({ format: "date" })
  @IsOptional()
  @IsDateString({ strict: true })
  dateTo?: string;
}
