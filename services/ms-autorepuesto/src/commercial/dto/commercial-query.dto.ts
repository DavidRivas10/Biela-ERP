import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { booleanQueryTransform } from "../../common/validation/boolean-query.transform";

export enum CommercialSettlementStatus {
  UNPAID = "UNPAID",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  PAID = "PAID",
}

export class CommercialDocumentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CommercialSettlementStatus })
  @IsOptional()
  @IsEnum(CommercialSettlementStatus)
  settlementStatus?: CommercialSettlementStatus;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(booleanQueryTransform)
  @IsBoolean()
  overdueOnly?: boolean;

  @ApiPropertyOptional({ format: "date" })
  @IsOptional()
  @IsDateString({ strict: true })
  dueFrom?: string;

  @ApiPropertyOptional({ format: "date" })
  @IsOptional()
  @IsDateString({ strict: true })
  dueTo?: string;

  @ApiPropertyOptional({ format: "date" })
  @IsOptional()
  @IsDateString({ strict: true })
  documentFrom?: string;

  @ApiPropertyOptional({ format: "date" })
  @IsOptional()
  @IsDateString({ strict: true })
  documentTo?: string;
}

export class ReceivablesQueryDto extends CommercialDocumentQueryDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  customerId?: string;
}

export class PayablesQueryDto extends CommercialDocumentQueryDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
