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
    // Per libpq/Postgres convention, only `verify-full` performs full CA-chain +
    // hostname verification (pg `ssl: true` => rejectUnauthorized: true). `require`
    // means "encrypt, but do NOT verify the certificate" — so it must NOT map to
    // full verification, or a self-signed / internal-CA Postgres set to `require`
    // would fail to connect. `no-verify` and `require` both encrypt without verify.
    poolConfig.ssl = config.databaseSslMode === "verify-full" ? true : { rejectUnauthorized: false };
  }

  const pool = new Pool(poolConfig);

  // pg emits `error` out-of-band when a backend error or network partition hits
  // an idle pooled client (Postgres reboot/failover/idle-connection drop). With
  // no listener Node turns that into an uncaught exception that would crash this
  // single long-running service. Logging it lets pg quietly drop the bad client.
  pool.on("error", (error) => {
    console.error(`[${config.serviceName}] idle database client error`, error);
  });

  return pool;
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
