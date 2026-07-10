import { timingSafeEqual } from "node:crypto";

import type { ApiConfig } from "./config";
import { checkDatabase } from "./db";
import { emptyResponse, jsonResponse, notFound } from "./http";
import type { WaitlistSignup, WaitlistStore } from "./waitlist";

type HealthBody = {
  checks?: Record<string, unknown>;
  service: string;
  status: "ok" | "degraded";
  timestamp: string;
  uptimeSeconds: number;
};

export type AppDependencies = {
  onWaitlistRecorded?: () => void;
  waitlistStore: WaitlistStore | null;
};

function healthBase(config: ApiConfig, status: HealthBody["status"]): Omit<HealthBody, "checks"> {
  return {
    service: config.serviceName,
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  };
}

function authorized(request: Request, expected: string): boolean {
  const value = request.headers.get("Authorization");
  if (!value?.startsWith("Bearer ")) return false;
  const actual = Buffer.from(value.slice("Bearer ".length));
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

function parseSignup(body: unknown): WaitlistSignup | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const source = typeof value.source === "string" ? value.source.trim() : "";
  const at = typeof value.at === "string" ? value.at : "";
  const emailValid = email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const timestamp = new Date(at);
  if (!emailValid || !source || source.length > 64 || !at || Number.isNaN(timestamp.getTime())) return null;
  return { at: timestamp.toISOString(), email, source };
}

export function createRequestHandler(config: ApiConfig, dependencies: AppDependencies) {
  return async function route(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return emptyResponse(config, request);

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return jsonResponse(config, request, {
        cdnOrigin: config.cdnOrigin,
        service: config.serviceName,
        status: "ok",
      });
    }

    if (request.method === "GET" && url.pathname === "/health/live") {
      return jsonResponse(config, request, healthBase(config, "ok"));
    }

    if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/health/ready")) {
      const database = await checkDatabase(config);
      const waitlistConfig = config.nodeEnv === "production" && !config.waitlistIngestToken ? "missing" : "ok";
      const healthy = database.status === "ok" && waitlistConfig === "ok";

      return jsonResponse(
        config,
        request,
        {
          ...healthBase(config, healthy ? "ok" : "degraded"),
          checks: { database, waitlistConfig },
        },
        healthy ? 200 : 503,
      );
    }

    if (request.method === "GET" && url.pathname === "/v1/cdn") {
      return jsonResponse(config, request, {
        origin: config.cdnOrigin,
        socialCardsPrefix: `${config.cdnOrigin}/games`,
      });
    }

    if (request.method === "POST" && url.pathname === "/v1/waitlist") {
      if (!config.waitlistIngestToken || !dependencies.waitlistStore) {
        return jsonResponse(config, request, { error: { code: "persistence_unavailable" } }, 503);
      }
      if (!authorized(request, config.waitlistIngestToken)) {
        return jsonResponse(config, request, { error: { code: "unauthorized" } }, 401);
      }

      const signup = parseSignup(await request.json().catch(() => null));
      if (!signup) return jsonResponse(config, request, { error: { code: "invalid_signup" } }, 400);

      try {
        const result = await dependencies.waitlistStore.record(signup);
        dependencies.onWaitlistRecorded?.();
        return jsonResponse(config, request, { created: result.created, ok: true });
      } catch {
        // Persistence errors are intentionally generic and carry no address or
        // database details into application logs or the public response.
        console.error("[waitlist] persistence unavailable");
        return jsonResponse(config, request, { error: { code: "persistence_unavailable" } }, 503);
      }
    }

    return notFound(config, request);
  };
}
