import { tokenStorage } from "../auth/token-storage";

interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Record<
    string,
    | string
    | number
    | boolean
    | null
    | undefined
    | Array<string | number | boolean>
  >;
  authenticated?: boolean;
  handleUnauthorized?: boolean;
}

type UnauthorizedListener = () => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiNetworkError extends Error {
  constructor(message = "No fue posible conectar con el API Gateway.") {
    super(message);
    this.name = "ApiNetworkError";
  }
}

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  return (configured || "http://localhost:4000").replace(/\/$/, "");
}

export function subscribeUnauthorized(
  listener: UnauthorizedListener,
): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function notifyUnauthorized(): void {
  unauthorizedListeners.forEach((listener) => listener());
}

function requestUrl(path: string, query: ApiRequestOptions["query"]): string {
  const baseUrl = new URL(getApiBaseUrl());
  const url = new URL(path, `${baseUrl.toString().replace(/\/$/, "")}/`);
  if (!path.startsWith("/") || url.origin !== baseUrl.origin) {
    throw new Error(
      "Las solicitudes frontend deben usar rutas del API Gateway.",
    );
  }
  Object.entries(query ?? {}).forEach(([key, rawValue]) => {
    if (rawValue === undefined || rawValue === null) return;
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    values.forEach((value) => url.searchParams.append(key, String(value)));
  });
  return url.toString();
}

function errorMessage(payload: unknown, status: number): string {
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (Array.isArray(message)) return message.join(" ");
    if (typeof message === "string" && message.trim()) return message;
  }
  return `La solicitud no pudo completarse (HTTP ${status}).`;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    body,
    query,
    authenticated = true,
    handleUnauthorized = true,
    headers: optionHeaders,
    ...requestOptions
  } = options;
  const headers = new Headers(optionHeaders);
  headers.set("Accept", "application/json");
  if (body !== undefined) headers.set("Content-Type", "application/json");

  if (authenticated) {
    const token = tokenStorage.get();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const url = requestUrl(path, query);
  let response: Response;
  try {
    response = await fetch(url, {
      ...requestOptions,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new ApiNetworkError(
      error instanceof Error ? error.message : undefined,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const responseText = response.status === 204 ? "" : await response.text();
  let payload: unknown;
  if (!responseText) payload = undefined;
  else if (contentType.includes("application/json")) {
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      payload = undefined;
    }
  } else payload = responseText;

  if (!response.ok) {
    if (response.status === 401 && authenticated && handleUnauthorized) {
      notifyUnauthorized();
    }
    throw new ApiError(
      errorMessage(payload, response.status),
      response.status,
      payload,
    );
  }

  return payload as T;
}

export function isApiUnavailable(error: unknown): boolean {
  return (
    error instanceof ApiNetworkError ||
    (error instanceof ApiError &&
      (error.status === 502 || error.status === 503))
  );
}
