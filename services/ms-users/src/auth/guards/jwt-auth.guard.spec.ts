import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UsersService } from "../../users/users.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

function contextWithAuthorization(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  } as unknown as ExecutionContext;
}

describe("JwtAuthGuard", () => {
  const activeUser = {
    id: "507f1f77bcf86cd799439011",
    email: "user@example.com",
    firstName: "Test",
    lastName: "User",
    active: true,
    roles: [],
  };

  it("rejects a protected request without a bearer token", async () => {
    const guard = new JwtAuthGuard({} as JwtService, {} as UsersService);
    await expect(
      guard.canActivate(contextWithAuthorization()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("accepts a valid token for an active user", async () => {
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: activeUser.id }),
    };
    const users = {
      findAuthenticationContext: jest.fn().mockResolvedValue(activeUser),
    };
    const context = contextWithAuthorization("Bearer valid-token");
    const guard = new JwtAuthGuard(
      jwt as unknown as JwtService,
      users as unknown as UsersService,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("rejects an invalid token", async () => {
    const jwt = {
      verifyAsync: jest.fn().mockRejectedValue(new Error("invalid signature")),
    };
    const guard = new JwtAuthGuard(
      jwt as unknown as JwtService,
      {} as UsersService,
    );
    await expect(
      guard.canActivate(contextWithAuthorization("Bearer invalid-token")),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
