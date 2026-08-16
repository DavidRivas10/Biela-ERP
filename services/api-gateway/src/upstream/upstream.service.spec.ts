import { BadGatewayException, HttpException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UpstreamService } from "./upstream.service";

describe("UpstreamService", () => {
  const config = new ConfigService({
    MS_USERS_URL: "http://users.internal",
    MS_AUTOREPUESTO_URL: "http://autorepuesto.internal",
    UPSTREAM_TIMEOUT_MS: 1000,
  });
  let service: UpstreamService;

  beforeEach(() => {
    service = new UpstreamService(config);
    jest.restoreAllMocks();
  });

  it("forwards login payloads to ms-users and returns the JWT response", async () => {
    const response = {
      accessToken: "jwt",
      user: { email: "admin@example.com" },
    };
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(response), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      service.request("users", {
        method: "POST",
        path: "auth/login",
        body: { email: "admin@example.com", password: "secret" },
      }),
    ).resolves.toEqual(response);
    expect(fetch).toHaveBeenCalledWith(
      new URL("http://users.internal/auth/login"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("preserves an upstream authentication error", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    try {
      await service.request("users", { path: "auth/me" });
      throw new Error("Expected request to reject");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(401);
    }
  });

  it("normalizes network errors without leaking connection details", async () => {
    jest
      .spyOn(global, "fetch")
      .mockRejectedValue(new Error("ECONNREFUSED 10.0.0.4"));
    await expect(service.request("users", { path: "health" })).rejects.toEqual(
      new BadGatewayException({
        statusCode: 502,
        error: "Bad Gateway",
        message: "users service is unavailable",
      }),
    );
  });
});
