import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type UpstreamName = "users" | "autorepuesto";

export interface UpstreamRequest {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  authorization?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface UpstreamUpload {
  path: string;
  authorization?: string;
  fieldName?: string;
  file: { buffer: Buffer; originalname: string; mimetype: string };
}

export interface UpstreamBinary {
  status: number;
  contentType: string;
  contentDisposition?: string;
  body: Buffer;
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

  /**
   * Forward a single uploaded file to an upstream service as multipart/form-data.
   * The Gateway parses the browser upload, then re-emits it; it stores nothing
   * and adds no business logic.
   */
  async upload<T = unknown>(
    upstream: UpstreamName,
    options: UpstreamUpload,
  ): Promise<T> {
    const baseUrl = this.getBaseUrl(upstream);
    const url = new URL(options.path, `${baseUrl}/`);
    const form = new FormData();
    form.append(
      options.fieldName ?? "file",
      new Blob([new Uint8Array(options.file.buffer)], {
        type: options.file.mimetype,
      }),
      options.file.originalname,
    );
    const headers = new Headers({ Accept: "application/json" });
    if (options.authorization)
      headers.set("Authorization", options.authorization);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: form,
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
        `${upstream} upstream upload failed: ${this.safeErrorName(error)}`,
      );
      throw new BadGatewayException({
        statusCode: 502,
        error: "Bad Gateway",
        message: `${upstream} service is unavailable`,
      });
    }
  }

  /**
   * Fetch raw bytes (e.g. an uploaded photo) from an upstream service, keeping
   * its Content-Type and Content-Disposition so the browser renders it as sent.
   */
  async getBinary(
    upstream: UpstreamName,
    options: Pick<UpstreamRequest, "path" | "authorization" | "query">,
  ): Promise<UpstreamBinary> {
    const baseUrl = this.getBaseUrl(upstream);
    const url = new URL(options.path, `${baseUrl}/`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (Array.isArray(value))
        value.forEach((entry) => url.searchParams.append(key, entry));
      else if (value !== undefined) url.searchParams.set(key, value);
    }
    const headers = new Headers();
    if (options.authorization)
      headers.set("Authorization", options.authorization);

    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(
          this.config.getOrThrow<number>("UPSTREAM_TIMEOUT_MS"),
        ),
      });
      if (!response.ok) {
        const responseBody: unknown = await response
          .json()
          .catch(() => ({ message: "Upstream error" }));
        const exceptionBody =
          typeof responseBody === "string"
            ? responseBody
            : (responseBody as Record<string, never>);
        throw new HttpException(exceptionBody, response.status);
      }
      const body = Buffer.from(await response.arrayBuffer());
      return {
        status: response.status,
        contentType:
          response.headers.get("content-type") ?? "application/octet-stream",
        contentDisposition:
          response.headers.get("content-disposition") ?? undefined,
        body,
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `${upstream} upstream binary fetch failed: ${this.safeErrorName(error)}`,
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
