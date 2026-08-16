import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Connection } from "mongoose";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  @ApiOperation({ summary: "Check service and MongoDB connectivity" })
  async check() {
    try {
      if (this.connection.readyState !== 1 || !this.connection.db)
        throw new Error("not ready");
      await this.connection.db.admin().ping();
      return { status: "ok", service: "ms-users", database: "connected" };
    } catch {
      throw new ServiceUnavailableException({
        status: "error",
        service: "ms-users",
        database: "disconnected",
      });
    }
  }
}
