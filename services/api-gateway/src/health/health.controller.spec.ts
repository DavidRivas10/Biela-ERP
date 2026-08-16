import { UpstreamService } from "../upstream/upstream.service";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("reports the gateway as healthy without an upstream dependency", () => {
    const upstream = { request: jest.fn() };
    const controller = new HealthController(
      upstream as unknown as UpstreamService,
    );
    expect(controller.gateway()).toEqual({
      status: "ok",
      service: "api-gateway",
    });
  });

  it("reports both upstream services in system health", async () => {
    const upstream = {
      request: jest
        .fn()
        .mockImplementation((service: string) =>
          Promise.resolve({
            status: "ok",
            service: `ms-${service}`,
            database: "connected",
          }),
        ),
    };
    const controller = new HealthController(
      upstream as unknown as UpstreamService,
    );
    await expect(controller.system()).resolves.toMatchObject({
      status: "ok",
      services: {
        users: { status: "ok" },
        autorepuesto: { status: "ok" },
      },
    });
  });
});
