import { Global, Module } from "@nestjs/common";
import { AutorepuestoAuthGuard } from "./guards/autorepuesto-auth.guard";
import { BusinessPermissionsGuard } from "./guards/business-permissions.guard";
import { InventoryMovementPermissionsGuard } from "./guards/inventory-movement-permissions.guard";

@Global()
@Module({
  providers: [
    AutorepuestoAuthGuard,
    BusinessPermissionsGuard,
    InventoryMovementPermissionsGuard,
  ],
  exports: [
    AutorepuestoAuthGuard,
    BusinessPermissionsGuard,
    InventoryMovementPermissionsGuard,
  ],
})
export class AuthModule {}
