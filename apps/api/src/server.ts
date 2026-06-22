import { loadConfig } from "./config";
import { checkDatabase, closeDatabase } from "./db";
import { emptyResponse, jsonResponse, notFound } from "./http";

const config = loadConfig();

type HealthBody = {
  checks?: Record<string, unknown>;
  service: string;
  status: "ok" | "degraded";
  timestamp: string;
  uptimeSeconds: number;
};

function healthBase(status: HealthBody["status"]): Omit<HealthBody, "checks"> {
  return {
    service: config.serviceName,
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  };
}

async function route(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return emptyResponse(config, request);
  }

  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/") {
    return jsonResponse(config, request, {
      cdnOrigin: config.cdnOrigin,
      service: config.serviceName,
      status: "ok",
    });
  }

  if (request.method === "GET" && url.pathname === "/health/live") {
    return jsonResponse(config, request, healthBase("ok"));
  }

  if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/health/ready")) {
    const database = await checkDatabase(config);
    const healthy = database.status === "ok";

    return jsonResponse(
      config,
      request,
      {
        ...healthBase(healthy ? "ok" : "degraded"),
        checks: {
          database,
        },
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

  return notFound(config, request);
}

const server = Bun.serve({
  fetch: route,
  hostname: config.host,
  port: config.port,
});

console.log(`${config.serviceName} listening on ${server.hostname}:${server.port}`);

async function shutdown(signal: string): Promise<void> {
  console.log(`${config.serviceName} received ${signal}; shutting down`);
  server.stop(true);
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
