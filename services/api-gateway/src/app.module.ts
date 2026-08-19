import path from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { envValidationSchema } from "./config/env.validation";
import { HealthModule } from "./health/health.module";
import { RolesModule } from "./roles/roles.module";
import { UpstreamModule } from "./upstream/upstream.module";
import { UsersModule } from "./users/users.module";
import { CatalogModule } from "./catalog/catalog.module";
import { OperationsModule } from "./operations/operations.module";
import { PurchasingModule } from "./purchasing/purchasing.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [path.resolve(__dirname, "../../../.env"), ".env"],
      validationSchema: envValidationSchema,
    }),
    UpstreamModule,
    AuthModule,
    UsersModule,
    RolesModule,
    HealthModule,
    CatalogModule,
    OperationsModule,
    PurchasingModule,
  ],
})
export class AppModule {}
