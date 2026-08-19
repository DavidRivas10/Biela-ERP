import path from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { envValidationSchema } from "./config/env.validation";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { ProductsModule } from "./products/products.module";
import { VehiclesModule } from "./vehicles/vehicles.module";
import { CompatibilitiesModule } from "./compatibilities/compatibilities.module";
import { AuthModule } from "./auth/auth.module";
import { LocationsModule } from "./locations/locations.module";
import { InventoryModule } from "./inventory/inventory.module";
import { SearchModule } from "./search/search.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [path.resolve(__dirname, "../../../.env"), ".env"],
      validationSchema: envValidationSchema,
    }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    ProductsModule,
    VehiclesModule,
    CompatibilitiesModule,
    LocationsModule,
    InventoryModule,
    SearchModule,
  ],
})
export class AppModule {}
