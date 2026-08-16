import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { UpstreamService } from "../upstream/upstream.service";

interface ServiceHealth {
  status: "ok" | "error";
  service: string;
  database?: string;
}

@ApiTags("health")
@Controller()
export class HealthController {
  constructor(private readonly upstream: UpstreamService) {}

  @Get("health")
  @ApiOperation({ summary: "Check the API Gateway process" })
  gateway() {
    return { status: "ok", service: "api-gateway" };
  }

  @Get("api/system/health")
  @ApiOperation({ summary: "Check the Gateway and both Phase 1 services" })
  async system() {
    const [users, autorepuesto] = await Promise.all([
      this.healthOf("users"),
      this.healthOf("autorepuesto"),
    ]);
    const healthy = users.status === "ok" && autorepuesto.status === "ok";
    return {
      status: healthy ? "ok" : "degraded",
      services: { gateway: { status: "ok" }, users, autorepuesto },
    };
  }

  private async healthOf(
    service: "users" | "autorepuesto",
  ): Promise<ServiceHealth> {
    try {
      return await this.upstream.request<ServiceHealth>(service, {
        path: "health",
      });
    } catch {
      return { status: "error", service: `ms-${service}` };
    }
  }
}
