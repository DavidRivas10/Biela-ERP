import { Module } from "@nestjs/common";
import {
  ProductAttributeDefinitionsController,
  ProductBrandsController,
  ProductCategoriesController,
} from "./product-catalogs.controller";
import { ProductCatalogsService } from "./product-catalogs.service";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  controllers: [
    ProductsController,
    ProductCategoriesController,
    ProductBrandsController,
    ProductAttributeDefinitionsController,
  ],
  providers: [ProductsService, ProductCatalogsService],
  exports: [ProductsService],
})
export class ProductsModule {}
