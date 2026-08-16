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
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { BUSINESS_PERMISSIONS } from "../auth/constants/business-permissions";
import { RequireBusinessPermissions } from "../auth/decorators/permissions.decorator";
import { AutorepuestoAuthGuard } from "../auth/guards/autorepuesto-auth.guard";
import { BusinessPermissionsGuard } from "../auth/guards/business-permissions.guard";
import {
  CreateProductBrandDto,
  CreateProductCategoryDto,
  UpdateProductBrandDto,
  UpdateProductCategoryDto,
} from "./dto/catalog.dto";
import {
  CreateProductAttributeDefinitionDto,
  ListProductAttributeDefinitionsQueryDto,
  UpdateProductAttributeDefinitionDto,
} from "./dto/product-attribute-definition.dto";
import { ProductCatalogsService } from "./product-catalogs.service";

@ApiTags("product-categories")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller("product-categories")
export class ProductCategoriesController {
  constructor(private readonly catalogs: ProductCatalogsService) {}

  @Post()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PRODUCTS_CREATE)
  @ApiOperation({ summary: "Create a product category" })
  create(@Body() dto: CreateProductCategoryDto) {
    return this.catalogs.createCategory(dto);
  }

  @Get()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PRODUCTS_READ)
  @ApiOperation({ summary: "List product categories" })
  findAll() {
    return this.catalogs.listCategories();
  }

  @Patch(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PRODUCTS_UPDATE)
  @ApiOperation({ summary: "Update a product category" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductCategoryDto,
  ) {
    return this.catalogs.updateCategory(id, dto);
  }
}

@ApiTags("product-brands")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller("product-brands")
export class ProductBrandsController {
  constructor(private readonly catalogs: ProductCatalogsService) {}

  @Post()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PRODUCTS_CREATE)
  @ApiOperation({ summary: "Create a product manufacturer/brand" })
  create(@Body() dto: CreateProductBrandDto) {
    return this.catalogs.createBrand(dto);
  }

  @Get()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PRODUCTS_READ)
  @ApiOperation({ summary: "List product manufacturers/brands" })
  findAll() {
    return this.catalogs.listBrands();
  }

  @Patch(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PRODUCTS_UPDATE)
  @ApiOperation({ summary: "Update a product manufacturer/brand" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductBrandDto,
  ) {
    return this.catalogs.updateBrand(id, dto);
  }
}

@ApiTags("product-attribute-definitions")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller("product-attribute-definitions")
export class ProductAttributeDefinitionsController {
  constructor(private readonly catalogs: ProductCatalogsService) {}

  @Post()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PRODUCTS_CREATE)
  @ApiOperation({
    summary: "Create a controlled category-specific product attribute",
  })
  create(@Body() dto: CreateProductAttributeDefinitionDto) {
    return this.catalogs.createAttributeDefinition(dto);
  }

  @Get()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PRODUCTS_READ)
  @ApiQuery({ name: "categoryId", required: false, format: "uuid" })
  @ApiOperation({ summary: "List controlled product attribute definitions" })
  findAll(@Query() query: ListProductAttributeDefinitionsQueryDto) {
    return this.catalogs.listAttributeDefinitions(query.categoryId);
  }

  @Patch(":id")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PRODUCTS_UPDATE)
  @ApiOperation({ summary: "Update a controlled product attribute definition" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductAttributeDefinitionDto,
  ) {
    return this.catalogs.updateAttributeDefinition(id, dto);
  }
}
