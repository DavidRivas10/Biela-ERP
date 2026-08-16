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

@ApiTags("vehicles")
@ApiBearerAuth()
@Controller("api")
export class VehiclesController {
  constructor(private readonly upstream: UpstreamService) {}

  @Post("vehicles")
  @ApiBody({
    schema: { type: "object", required: ["modelId", "year", "engine"] },
  })
  @ApiOperation({ summary: "Create a vehicle through ms-autorepuesto" })
  createVehicle(
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("POST", "vehicles", authorization, body);
  }

  @Get("vehicles")
  @ApiOperation({ summary: "List and filter vehicles through ms-autorepuesto" })
  listVehicles(
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: "vehicles",
      authorization,
      query,
    });
  }

  @Get("vehicles/:id")
  @ApiOperation({ summary: "Get a vehicle through ms-autorepuesto" })
  getVehicle(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: `vehicles/${id}`,
      authorization,
    });
  }

  @Patch("vehicles/:id")
  @ApiOperation({ summary: "Update a vehicle through ms-autorepuesto" })
  updateVehicle(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("PATCH", `vehicles/${id}`, authorization, body);
  }

  @Patch("vehicles/:id/activate")
  @ApiOperation({ summary: "Activate a vehicle through ms-autorepuesto" })
  activateVehicle(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("PATCH", `vehicles/${id}/activate`, authorization);
  }

  @Patch("vehicles/:id/deactivate")
  @ApiOperation({ summary: "Deactivate a vehicle through ms-autorepuesto" })
  deactivateVehicle(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("PATCH", `vehicles/${id}/deactivate`, authorization);
  }

  @Get("vehicles/:id/products")
  @ApiOperation({ summary: "List products compatible with a vehicle" })
  compatibleProducts(
    @Param("id") id: string,
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: `vehicles/${id}/products`,
      authorization,
      query,
    });
  }

  @Post("vehicle-brands")
  @ApiOperation({ summary: "Create a vehicle brand" })
  createBrand(
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("POST", "vehicle-brands", authorization, body);
  }

  @Get("vehicle-brands")
  @ApiOperation({ summary: "List vehicle brands" })
  listBrands(@Headers("authorization") authorization?: string) {
    return this.upstream.request("autorepuesto", {
      path: "vehicle-brands",
      authorization,
    });
  }

  @Patch("vehicle-brands/:id")
  @ApiOperation({ summary: "Update a vehicle brand" })
  updateBrand(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("PATCH", `vehicle-brands/${id}`, authorization, body);
  }

  @Post("vehicle-models")
  @ApiOperation({ summary: "Create a vehicle model" })
  createModel(
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("POST", "vehicle-models", authorization, body);
  }

  @Get("vehicle-models")
  @ApiOperation({ summary: "List vehicle models" })
  listModels(
    @Query() query: ProxyQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.upstream.request("autorepuesto", {
      path: "vehicle-models",
      authorization,
      query,
    });
  }

  @Patch("vehicle-models/:id")
  @ApiOperation({ summary: "Update a vehicle model" })
  updateModel(
    @Param("id") id: string,
    @Body() body: ProxyBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.request("PATCH", `vehicle-models/${id}`, authorization, body);
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
