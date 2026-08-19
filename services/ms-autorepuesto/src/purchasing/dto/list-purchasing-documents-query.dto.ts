import { PurchasingDocumentStatus } from "@prisma/client";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ListPurchasingDocumentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PurchasingDocumentStatus })
  @IsOptional()
  @IsEnum(PurchasingDocumentStatus)
  status?: PurchasingDocumentStatus;
}
