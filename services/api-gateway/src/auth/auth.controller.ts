import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UpstreamService } from "../upstream/upstream.service";
import { LoginDto } from "./dto/login.dto";

@ApiTags("authentication")
@Controller("api/auth")
export class AuthController {
  constructor(private readonly upstream: UpstreamService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Authenticate through ms-users" })
  login(@Body() dto: LoginDto) {
    return this.upstream.request("users", {
      method: "POST",
      path: "auth/login",
      body: dto,
    });
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Return the authenticated user through ms-users" })
  me(@Headers("authorization") authorization?: string) {
    return this.upstream.request("users", { path: "auth/me", authorization });
  }
}
