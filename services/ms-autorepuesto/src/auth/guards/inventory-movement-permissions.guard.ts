import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { InventoryMovementType } from "@prisma/client";
import { BUSINESS_PERMISSIONS } from "../constants/business-permissions";
import { AuthorizedRequest } from "../interfaces/authorization-user";

@Injectable()
export class InventoryMovementPermissionsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    const body = request.body as { type?: unknown };
    const required =
      body.type === InventoryMovementType.TRANSFER
        ? BUSINESS_PERMISSIONS.INVENTORY_TRANSFER
        : BUSINESS_PERMISSIONS.INVENTORY_ADJUST;
    const assigned = new Set(
      request.user.roles.flatMap((role) => role.permissions),
    );
    if (!assigned.has(required))
      throw new ForbiddenException("Insufficient permissions");
    return true;
  }
}
