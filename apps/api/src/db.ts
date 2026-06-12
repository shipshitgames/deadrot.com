import { Pool, type PoolConfig } from "pg";
import type { ApiConfig } from "./config";

export type DatabaseCheck =
  | {
      database: string;
      latencyMs: number;
      status: "ok";
    }
  | {
      latencyMs: number;
      message: string;
      status: "error" | "missing";
    };

let pool: Pool | undefined;

function createPool(config: ApiConfig): Pool {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required for database access");
  }

  const poolConfig: PoolConfig = {
    connectionString: config.databaseUrl,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  };

  if (config.databaseSslMode !== "disable") {
    poolConfig.ssl =
      config.databaseSslMode === "verify-full" || config.databaseSslMode === "require"
        ? true
        : { rejectUnauthorized: false };
  }

  return new Pool(poolConfig);
}

export function getPool(config: ApiConfig): Pool {
  pool ??= createPool(config);
  return pool;
}

export async function checkDatabase(config: ApiConfig): Promise<DatabaseCheck> {
  const startedAt = performance.now();

  if (!config.databaseUrl) {
    return {
      latencyMs: 0,
      message: "DATABASE_URL is not configured",
      status: "missing",
    };
  }

  try {
    const result = await getPool(config).query<{ database: string }>("select current_database() as database");

    return {
      database: result.rows[0]?.database ?? "unknown",
      latencyMs: Math.round(performance.now() - startedAt),
      status: "ok",
    };
  } catch (error) {
    return {
      latencyMs: Math.round(performance.now() - startedAt),
      message: error instanceof Error ? error.message : "Unknown database error",
      status: "error",
    };
  }
}

export async function closeDatabase(): Promise<void> {
  if (!pool) return;

  const currentPool = pool;
  pool = undefined;
  await currentPool.end();
}
