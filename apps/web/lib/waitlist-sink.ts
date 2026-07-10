import { mkdir, open } from "node:fs/promises";
import { dirname } from "node:path";

import type { WaitlistSignup } from "@/lib/waitlist";

export class WaitlistPersistenceError extends Error {
  constructor() {
    super("Waitlist persistence is unavailable");
    this.name = "WaitlistPersistenceError";
  }
}

function isLocalRuntime(env: NodeJS.ProcessEnv): boolean {
  return (
    (env.NODE_ENV === "development" || env.NODE_ENV === "test") &&
    env.VERCEL_ENV !== "preview" &&
    env.VERCEL_ENV !== "production"
  );
}

function apiTarget(env: NodeJS.ProcessEnv): URL | null {
  const raw = env.WAITLIST_API_URL?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    const validProtocol = url.protocol === "https:" || (isLocalRuntime(env) && localHost && url.protocol === "http:");
    if (!validProtocol || url.username || url.password || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

async function appendLocalRecord(path: string, signup: WaitlistSignup): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const file = await open(path, "a", 0o600);
  try {
    await file.chmod(0o600);
    await file.appendFile(`${JSON.stringify(signup)}\n`, "utf8");
    await file.sync();
  } finally {
    await file.close();
  }
}

/**
 * Record a signup durably before the route reports success.
 *
 * Production/preview use the first-party Postgres-backed API. An explicitly
 * configured, fsynced JSONL file is available only to local dev/E2E. There is no
 * logging fallback: missing or unavailable persistence rejects the request.
 */
export async function recordSignup(
  signup: WaitlistSignup,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const target = apiTarget(env);
  const token = env.WAITLIST_API_TOKEN?.trim();

  if (target && token) {
    try {
      const response = await fetchImpl(target, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(signup),
        signal: AbortSignal.timeout(7_000),
      });
      if (response.ok) return;
    } catch {
      // The route reports a generic retryable error below. Never log addresses,
      // response bodies, tokens, or target URLs from this privacy-sensitive path.
    }
    throw new WaitlistPersistenceError();
  }

  const localFile = env.WAITLIST_LOCAL_FILE?.trim();
  if (localFile && isLocalRuntime(env)) {
    try {
      await appendLocalRecord(localFile, signup);
      return;
    } catch {
      throw new WaitlistPersistenceError();
    }
  }

  throw new WaitlistPersistenceError();
}
