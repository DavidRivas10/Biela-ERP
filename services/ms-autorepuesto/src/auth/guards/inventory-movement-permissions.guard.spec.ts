import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { InventoryMovementPermissionsGuard } from "./inventory-movement-permissions.guard";

function context(type: string, permissions: string[]): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        body: { type },
        user: { roles: [{ permissions }] },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe("InventoryMovementPermissionsGuard", () => {
  const guard = new InventoryMovementPermissionsGuard();

  it("requires inventory.adjust for non-transfer commands", () => {
    expect(guard.canActivate(context("OUT", ["inventory.adjust"]))).toBe(true);
    expect(() => guard.canActivate(context("OUT", ["inventory.read"]))).toThrow(
      ForbiddenException,
    );
  });

  it("requires inventory.transfer for transfer commands", () => {
    expect(guard.canActivate(context("TRANSFER", ["inventory.transfer"]))).toBe(
      true,
    );
    expect(() =>
      guard.canActivate(context("TRANSFER", ["inventory.adjust"])),
    ).toThrow(ForbiddenException);
  });
});
