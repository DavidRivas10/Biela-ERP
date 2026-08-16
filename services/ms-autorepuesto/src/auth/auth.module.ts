import { Global, Module } from "@nestjs/common";
import { AutorepuestoAuthGuard } from "./guards/autorepuesto-auth.guard";
import { BusinessPermissionsGuard } from "./guards/business-permissions.guard";

@Global()
@Module({
  providers: [AutorepuestoAuthGuard, BusinessPermissionsGuard],
  exports: [AutorepuestoAuthGuard, BusinessPermissionsGuard],
})
export class AuthModule {}
