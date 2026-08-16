import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import {
  AuthorizationUser,
  AuthorizedRequest,
} from "../interfaces/authorization-user";

@Injectable()
export class AutorepuestoAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Authentication required");
    }

    try {
      const baseUrl = this.config
        .getOrThrow<string>("MS_USERS_URL")
        .replace(/\/$/, "");
      const response = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: authorization, Accept: "application/json" },
        signal: AbortSignal.timeout(
          this.config.getOrThrow<number>("UPSTREAM_TIMEOUT_MS"),
        ),
      });
      if (!response.ok)
        throw new UnauthorizedException("Invalid or expired access token");
      const user = (await response.json()) as AuthorizationUser;
      if (!user.active || !Array.isArray(user.roles)) {
        throw new UnauthorizedException("Invalid or expired access token");
      }
      (request as AuthorizedRequest).user = user;
      return true;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) throw error;
      throw new ServiceUnavailableException(
        "Authentication service is unavailable",
      );
    }
  }
}
