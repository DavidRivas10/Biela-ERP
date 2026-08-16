import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UpstreamService } from "../upstream/upstream.service";

type ProxyBody = Record<string, unknown>;
type ProxyQuery = Record<string, string | string[] | undefined>;

@ApiTags("products")
@ApiBearerAuth()
@Controller("api")
export class ProductsController {
  constructor(private readonly upstream: UpstreamService) {}

  @Post("products")
  @ApiBody({
    schema: {
      type: "object",
      required: ["code", "name", "categoryId", "brandId"],
    },
  })
  @ApiOperation({ summary: "Create a product through ms-autorepuesto" })
  createProduct(
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("POST", "products", authorization, body);
  }

  @Get("products")
  @ApiOperation({ summary: "List and filter products through ms-autorepuesto" })
  listProducts(
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: "products",
      authorization,
      query,
    });
  }

  @Get("products/:id")
  @ApiOperation({ summary: "Get a product through ms-autorepuesto" })
  getProduct(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: `products/${id}`,
      authorization,
    });
  }

  @Patch("products/:id")
  @ApiBody({ schema: { type: "object" } })
  @ApiOperation({ summary: "Update a product through ms-autorepuesto" })
  updateProduct(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("PATCH", `products/${id}`, authorization, body);
  }

  @Patch("products/:id/activate")
  @ApiOperation({ summary: "Activate a product through ms-autorepuesto" })
  activateProduct(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("PATCH", `products/${id}/activate`, authorization);
  }

  @Patch("products/:id/deactivate")
  @ApiOperation({ summary: "Deactivate a product through ms-autorepuesto" })
  deactivateProduct(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("PATCH", `products/${id}/deactivate`, authorization);
  }

  @Get("products/:id/vehicles")
  @ApiOperation({ summary: "List vehicles compatible with a product" })
  compatibleVehicles(
    @Param("id") id: string,
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: `products/${id}/vehicles`,
      authorization,
      query,
    });
  }

  @Post("product-categories")
  @ApiBody({ schema: { type: "object", required: ["code", "name"] } })
  @ApiOperation({ summary: "Create a product category" })
  createCategory(
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("POST", "product-categories", authorization, body);
  }

  @Get("product-categories")
  @ApiOperation({ summary: "List product categories" })
  listCategories(@Headers("authorization") authorization?: string) {
    return this.upstream.request("autorepuesto", {
      path: "product-categories",
      authorization,
    });
  }

  @Patch("product-categories/:id")
  @ApiOperation({ summary: "Update a product category" })
  updateCategory(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request(
      "PATCH",
      `product-categories/${id}`,
      authorization,
      body,
    );
  }

  @Post("product-brands")
  @ApiOperation({ summary: "Create a product brand/manufacturer" })
  createBrand(
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("POST", "product-brands", authorization, body);
  }

  @Get("product-brands")
  @ApiOperation({ summary: "List product brands/manufacturers" })
  listBrands(@Headers("authorization") authorization?: string) {
    return this.upstream.request("autorepuesto", {
      path: "product-brands",
      authorization,
    });
  }

  @Patch("product-brands/:id")
  @ApiOperation({ summary: "Update a product brand/manufacturer" })
  updateBrand(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("PATCH", `product-brands/${id}`, authorization, body);
  }

  @Post("product-attribute-definitions")
  @ApiOperation({ summary: "Create a controlled product attribute definition" })
  createAttribute(
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request(
      "POST",
      "product-attribute-definitions",
      authorization,
      body,
    );
  }

  @Get("product-attribute-definitions")
  @ApiOperation({ summary: "List controlled product attribute definitions" })
  listAttributes(
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: "product-attribute-definitions",
      authorization,
      query,
    });
  }

  @Patch("product-attribute-definitions/:id")
  @ApiOperation({ summary: "Update a controlled product attribute definition" })
  updateAttribute(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request(
      "PATCH",
      `product-attribute-definitions/${id}`,
      authorization,
      body,
    );
  }

  private request(
    method: "POST" | "PATCH",
    path: string,
    authorization?: string,
    body?: ProxyBody,
  ) {
    return this.upstream.request("autorepuesto", {
      method,
      path,
      authorization,
      body,
    });
  }
}
