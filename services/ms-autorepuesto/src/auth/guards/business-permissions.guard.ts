import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { BUSINESS_PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { AuthorizedRequest } from "../interfaces/authorization-user";

@Injectable()
export class BusinessPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      BUSINESS_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    const assigned = new Set(
      request.user.roles.flatMap((role) => role.permissions),
    );
    if (!required.every((permission) => assigned.has(permission))) {
      throw new ForbiddenException("Insufficient permissions");
    }
    return true;
  }
}
