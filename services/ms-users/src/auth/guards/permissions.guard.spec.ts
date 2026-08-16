import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthUser } from "../../users/users.service";
import { PermissionsGuard } from "./permissions.guard";

function contextFor(user: AuthUser): ExecutionContext {
  return {
    getClass: jest.fn(),
    getHandler: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe("PermissionsGuard", () => {
  const user: AuthUser = {
    id: "1",
    email: "user@example.com",
    firstName: "Test",
    lastName: "User",
    active: true,
    roles: [{ id: "r1", name: "reader", permissions: ["users.read"] }],
  };

  it("allows a user who has every required permission", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["users.read"]),
    };
    const guard = new PermissionsGuard(reflector as unknown as Reflector);
    expect(guard.canActivate(contextFor(user))).toBe(true);
  });

  it("rejects a user without the required permission", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["roles.manage"]),
    };
    const guard = new PermissionsGuard(reflector as unknown as Reflector);
    expect(() => guard.canActivate(contextFor(user))).toThrow(
      ForbiddenException,
    );
  });
});
