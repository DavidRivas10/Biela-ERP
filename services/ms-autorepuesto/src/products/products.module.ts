import { Module } from "@nestjs/common";
import { FilesModule } from "../files/files.module";
import { ProductPhotosController } from "./product-photos.controller";
import { ProductPhotosService } from "./product-photos.service";
import {
  ProductAttributeDefinitionsController,
  ProductBrandsController,
  ProductCategoriesController,
} from "./product-catalogs.controller";
import { ProductCatalogsService } from "./product-catalogs.service";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [FilesModule],
  controllers: [
    ProductsController,
    ProductPhotosController,
    ProductCategoriesController,
    ProductBrandsController,
    ProductAttributeDefinitionsController,
  ],
  providers: [ProductsService, ProductCatalogsService, ProductPhotosService],
  exports: [ProductsService],
})
export class ProductsModule {}
