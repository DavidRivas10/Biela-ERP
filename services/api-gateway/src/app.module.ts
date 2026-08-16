import path from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { envValidationSchema } from "./config/env.validation";
import { HealthModule } from "./health/health.module";
import { RolesModule } from "./roles/roles.module";
import { UpstreamModule } from "./upstream/upstream.module";
import { UsersModule } from "./users/users.module";

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
  ],
})
export class AppModule {}
