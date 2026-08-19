import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AutorepuestoAuthGuard } from "./autorepuesto-auth.guard";

function contextWithAuthorization(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  } as unknown as ExecutionContext;
}

describe("AutorepuestoAuthGuard", () => {
  const config = new ConfigService({
    MS_USERS_URL: "http://users.internal",
    UPSTREAM_TIMEOUT_MS: 1000,
  });

  afterEach(() => jest.restoreAllMocks());

  it("rejects a request without a bearer token", async () => {
    const guard = new AutorepuestoAuthGuard(config);
    await expect(
      guard.canActivate(contextWithAuthorization()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("delegates token validation to ms-users", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "user-id",
          email: "admin@example.com",
          active: true,
          roles: [
            { id: "role", name: "admin", permissions: ["products.read"] },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const guard = new AutorepuestoAuthGuard(config);
    await expect(
      guard.canActivate(contextWithAuthorization("Bearer valid-token")),
    ).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "http://users.internal/auth/me",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer valid-token",
        }),
      }),
    );
  });

  it("rejects a token that ms-users does not authenticate", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Invalid access token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const guard = new AutorepuestoAuthGuard(config);
    await expect(
      guard.canActivate(contextWithAuthorization("Bearer invalid-token")),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("reports ms-users failures as service unavailable", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Database unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const guard = new AutorepuestoAuthGuard(config);
    await expect(
      guard.canActivate(contextWithAuthorization("Bearer valid-token")),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
