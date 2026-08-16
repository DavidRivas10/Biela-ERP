import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { BusinessPermissionsGuard } from "./business-permissions.guard";

function contextFor(permissions: string[]): ExecutionContext {
  return {
    getClass: jest.fn(),
    getHandler: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          roles: [{ id: "role", name: "catalog", permissions }],
        },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe("BusinessPermissionsGuard", () => {
  it("allows all required business permissions", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["products.read"]),
    };
    const guard = new BusinessPermissionsGuard(
      reflector as unknown as Reflector,
    );
    expect(guard.canActivate(contextFor(["products.read"]))).toBe(true);
  });

  it("rejects a missing business permission", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["products.update"]),
    };
    const guard = new BusinessPermissionsGuard(
      reflector as unknown as Reflector,
    );
    expect(() => guard.canActivate(contextFor(["products.read"]))).toThrow(
      ForbiddenException,
    );
  });
});
