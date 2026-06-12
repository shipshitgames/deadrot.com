import type { ApiConfig } from "./config";

export type JsonBody = Record<string, unknown> | Record<string, unknown>[];

export function jsonResponse(config: ApiConfig, request: Request, body: JsonBody, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: responseHeaders(config, request),
    status,
  });
}

export function emptyResponse(config: ApiConfig, request: Request): Response {
  return new Response(null, {
    headers: responseHeaders(config, request),
    status: 204,
  });
}

export function notFound(config: ApiConfig, request: Request): Response {
  return jsonResponse(
    config,
    request,
    {
      error: {
        code: "not_found",
        message: "Route not found",
      },
    },
    404,
  );
}

function responseHeaders(config: ApiConfig, request: Request): Headers {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });

  const origin = request.headers.get("Origin");
  if (origin && config.allowedOrigins.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Vary", "Origin");
  }

  return headers;
}
