import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type UpstreamName = "users" | "autorepuesto";

export interface UpstreamRequest {
  method?: "GET" | "POST" | "PATCH";
  path: string;
  authorization?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

@Injectable()
export class UpstreamService {
  private readonly logger = new Logger(UpstreamService.name);

  constructor(private readonly config: ConfigService) {}

  async request<T = unknown>(
    upstream: UpstreamName,
    options: UpstreamRequest,
  ): Promise<T> {
    const baseUrl = this.getBaseUrl(upstream);
    const url = new URL(options.path, `${baseUrl}/`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (Array.isArray(value))
        value.forEach((entry) => url.searchParams.append(key, entry));
      else if (value !== undefined) url.searchParams.set(key, value);
    }

    const headers = new Headers({ Accept: "application/json" });
    if (options.authorization)
      headers.set("Authorization", options.authorization);
    if (options.body !== undefined)
      headers.set("Content-Type", "application/json");

    try {
      const response = await fetch(url, {
        method: options.method ?? "GET",
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(
          this.config.getOrThrow<number>("UPSTREAM_TIMEOUT_MS"),
        ),
      });
      const responseBody: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const exceptionBody =
          typeof responseBody === "string"
            ? responseBody
            : (responseBody as Record<string, never>);
        throw new HttpException(exceptionBody, response.status);
      }
      return responseBody as T;
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `${upstream} upstream request failed: ${this.safeErrorName(error)}`,
      );
      throw new BadGatewayException({
        statusCode: 502,
        error: "Bad Gateway",
        message: `${upstream} service is unavailable`,
      });
    }
  }

  private getBaseUrl(upstream: UpstreamName): string {
    return this.config
      .getOrThrow<string>(
        upstream === "users" ? "MS_USERS_URL" : "MS_AUTOREPUESTO_URL",
      )
      .replace(/\/$/, "");
  }

  private safeErrorName(error: unknown): string {
    return error instanceof Error ? error.name : "UnknownError";
  }
}
