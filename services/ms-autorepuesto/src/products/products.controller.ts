import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { BUSINESS_PERMISSIONS } from "../auth/constants/business-permissions";
import { RequireBusinessPermissions } from "../auth/decorators/permissions.decorator";
import { AutorepuestoAuthGuard } from "../auth/guards/autorepuesto-auth.guard";
import { BusinessPermissionsGuard } from "../auth/guards/business-permissions.guard";
import { ListProductsQueryDto } from "./dto/list-products-query.dto";
import { CreateProductDto, UpdateProductDto } from "./dto/product.dto";
import { ProductsService } from "./products.service";

@ApiTags("products")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PRODUCTS_CREATE)
  @ApiOperation({ summary: "Create a product without inventory data" })
  @ApiConflictResponse({ description: "Product code already exists" })
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Get()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PRODUCTS_READ)
  @ApiOperation({ summary: "List and filter products with pagination" })
  findAll(@Query() query: ListProductsQueryDto) {
    return this.products.findAll(query);
  }

  @Get(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PRODUCTS_READ)
  @ApiOperation({ summary: "Get a product" })
  @ApiNotFoundResponse({ description: "Product not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.products.findOne(id);
  }

  @Patch(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PRODUCTS_UPDATE)
  @ApiOperation({
    summary: "Update a product and optionally replace its attributes",
  })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(id, dto);
  }

  @Patch(":id/activate")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PRODUCTS_UPDATE)
  @ApiOperation({ summary: "Activate a product" })
  activate(@Param("id", ParseUUIDPipe) id: string) {
    return this.products.setActive(id, true);
  }

  @Patch(":id/deactivate")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PRODUCTS_UPDATE)
  @ApiOperation({ summary: "Deactivate a product" })
  deactivate(@Param("id", ParseUUIDPipe) id: string) {
    return this.products.setActive(id, false);
  }
}
