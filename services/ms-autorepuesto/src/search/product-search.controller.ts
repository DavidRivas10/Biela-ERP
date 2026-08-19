import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { BUSINESS_PERMISSIONS } from "../auth/constants/business-permissions";
import { RequireBusinessPermissions } from "../auth/decorators/permissions.decorator";
import { AutorepuestoAuthGuard } from "../auth/guards/autorepuesto-auth.guard";
import { BusinessPermissionsGuard } from "../auth/guards/business-permissions.guard";
import { SearchProductsQueryDto } from "./dto/search-products-query.dto";
import { ProductSearchService } from "./product-search.service";

@ApiTags("search")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller("search")
export class ProductSearchController {
  constructor(private readonly searchService: ProductSearchService) {}

  @Get("products")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.SEARCH_READ)
  @ApiOperation({
    summary: "Deterministically search products",
    description:
      "Searches product code/name and explicit vehicle compatibility. Exact code ranks first; remaining results use stable code/id ordering.",
  })
  search(@Query() query: SearchProductsQueryDto) {
    return this.searchService.search(query);
  }
}
