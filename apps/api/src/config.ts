export type DatabaseSslMode = "disable" | "no-verify" | "require" | "verify-full";

export type ApiConfig = {
  allowedOrigins: string[];
  cdnOrigin: string;
  databaseSslMode: DatabaseSslMode;
  databaseUrl?: string;
  host: string;
  port: number;
  serviceName: string;
};

const DEFAULT_ALLOWED_ORIGINS = ["https://deadrot.com", "https://www.deadrot.com"];

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return parsed;
}

function parseOrigins(value: string | undefined): string[] {
  if (!value) return DEFAULT_ALLOWED_ORIGINS;

  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS;
}

function parseDatabaseSslMode(value: string | undefined): DatabaseSslMode {
  if (!value) return "no-verify";

  if (value === "disable" || value === "no-verify" || value === "require" || value === "verify-full") {
    return value;
  }

  throw new Error(`Invalid DATABASE_SSL_MODE value: ${value}`);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    allowedOrigins: parseOrigins(env.ALLOWED_ORIGINS),
    cdnOrigin: env.CDN_ORIGIN ?? "https://cdn.deadrot.com",
    databaseSslMode: parseDatabaseSslMode(env.DATABASE_SSL_MODE),
    databaseUrl: env.DATABASE_URL,
    host: env.HOST ?? "0.0.0.0",
    port: parsePort(env.PORT, 3004),
    serviceName: env.SERVICE_NAME ?? "deadrot-api",
  };
}
