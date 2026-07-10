import type { Pool, PoolClient } from "pg";

import type { ApiConfig } from "./config";
import { getPool } from "./db";

export type WaitlistSignup = {
  at: string;
  email: string;
  source: string;
};

export type WaitlistRecord = WaitlistSignup & {
  attempt: number;
  id: string;
};

export type RecordResult = {
  created: boolean;
  id: string;
};

export interface WaitlistStore {
  claimPending(limit: number, leaseSeconds: number): Promise<WaitlistRecord[]>;
  markDelivered(id: string): Promise<void>;
  markFailed(id: string, reason: string, availableAt: Date): Promise<void>;
  record(signup: WaitlistSignup): Promise<RecordResult>;
}

export interface ReadyWaitlistStore extends WaitlistStore {
  ready(): Promise<void>;
}

const WAITLIST_SCHEMA = `
  CREATE TABLE IF NOT EXISTS waitlist_signups (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE CHECK (char_length(email) <= 254),
    source TEXT NOT NULL CHECK (char_length(source) <= 64),
    captured_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS waitlist_outbox (
    signup_id BIGINT PRIMARY KEY REFERENCES waitlist_signups(id) ON DELETE CASCADE,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    lease_until TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    last_error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS waitlist_outbox_pending_idx
    ON waitlist_outbox (available_at)
    WHERE delivered_at IS NULL;
`;

class PostgresWaitlistStore implements ReadyWaitlistStore {
  private schemaReady: Promise<void> | undefined;

  constructor(private readonly pool: Pool) {}

  ready(): Promise<void> {
    this.schemaReady ??= this.pool.query(WAITLIST_SCHEMA).then(() => undefined);
    return this.schemaReady;
  }

  async record(signup: WaitlistSignup): Promise<RecordResult> {
    await this.ready();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO waitlist_signups (email, source, captured_at, last_seen_at)
         VALUES ($1, $2, $3, $3)
         ON CONFLICT (email) DO NOTHING
         RETURNING id::text`,
        [signup.email, signup.source, signup.at],
      );

      const created = inserted.rowCount === 1;
      const id = created ? inserted.rows[0]?.id : await updateDuplicate(client, signup);
      if (!id) throw new Error("waitlist record did not return an id");

      await client.query(
        `INSERT INTO waitlist_outbox (signup_id)
         VALUES ($1)
         ON CONFLICT (signup_id) DO NOTHING`,
        [id],
      );
      await client.query("COMMIT");
      return { created, id };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async claimPending(limit: number, leaseSeconds: number): Promise<WaitlistRecord[]> {
    await this.ready();
    const result = await this.pool.query<{
      at: Date;
      attempt: number;
      email: string;
      id: string;
      source: string;
    }>(
      `WITH candidates AS (
         SELECT signup_id
         FROM waitlist_outbox
         WHERE delivered_at IS NULL
           AND available_at <= now()
           AND (lease_until IS NULL OR lease_until <= now())
         ORDER BY available_at, signup_id
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE waitlist_outbox AS outbox
       SET lease_until = now() + ($2 * interval '1 second'),
           attempt_count = outbox.attempt_count + 1,
           updated_at = now()
       FROM candidates, waitlist_signups AS signup
       WHERE outbox.signup_id = candidates.signup_id
         AND signup.id = outbox.signup_id
       RETURNING outbox.signup_id::text AS id,
                 outbox.attempt_count AS attempt,
                 signup.email,
                 signup.source,
                 signup.captured_at AS at`,
      [limit, leaseSeconds],
    );

    return result.rows.map((row) => ({
      at: row.at.toISOString(),
      attempt: row.attempt,
      email: row.email,
      id: row.id,
      source: row.source,
    }));
  }

  async markDelivered(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE waitlist_outbox
       SET delivered_at = now(), lease_until = NULL, last_error = NULL, updated_at = now()
       WHERE signup_id = $1`,
      [id],
    );
  }

  async markFailed(id: string, reason: string, availableAt: Date): Promise<void> {
    await this.pool.query(
      `UPDATE waitlist_outbox
       SET available_at = $2, lease_until = NULL, last_error = $3, updated_at = now()
       WHERE signup_id = $1 AND delivered_at IS NULL`,
      [id, availableAt, reason],
    );
  }
}

async function updateDuplicate(client: PoolClient, signup: WaitlistSignup): Promise<string | undefined> {
  const result = await client.query<{ id: string }>(
    `UPDATE waitlist_signups
     SET last_seen_at = GREATEST(last_seen_at, $2::timestamptz)
     WHERE email = $1
     RETURNING id::text`,
    [signup.email, signup.at],
  );
  return result.rows[0]?.id;
}

export function createPostgresWaitlistStore(config: ApiConfig): ReadyWaitlistStore {
  return new PostgresWaitlistStore(getPool(config));
}

type OutboxOptions = {
  fetchImpl?: typeof fetch;
  logger?: Pick<Console, "error">;
  now?: () => Date;
  retryDelayMs?: (attempt: number) => number;
};

export class WaitlistOutbox {
  private running = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly logger: Pick<Console, "error">;
  private readonly now: () => Date;
  private readonly retryDelayMs: (attempt: number) => number;

  constructor(
    private readonly store: WaitlistStore,
    private readonly forwardUrl: string | undefined,
    options: OutboxOptions = {},
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.logger = options.logger ?? console;
    this.now = options.now ?? (() => new Date());
    this.retryDelayMs = options.retryDelayMs ?? ((attempt) => Math.min(30_000 * 2 ** (attempt - 1), 6 * 60 * 60_000));
  }

  start(intervalMs = 30_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.wake(), intervalMs);
    this.timer.unref?.();
    this.wake();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  wake(): void {
    queueMicrotask(() => void this.flush());
  }

  async flush(): Promise<number> {
    if (!this.forwardUrl || this.running) return 0;
    this.running = true;
    try {
      const pending = await this.store.claimPending(20, 60);
      for (const record of pending) await this.deliver(record);
      return pending.length;
    } finally {
      this.running = false;
    }
  }

  private async deliver(record: WaitlistRecord): Promise<void> {
    let reason: string | undefined;
    try {
      const response = await this.fetchImpl(this.forwardUrl as string, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Idempotency-Key": `deadrot-waitlist-${record.id}`,
        },
        body: JSON.stringify({ email: record.email, source: record.source, at: record.at }),
        signal: AbortSignal.timeout(7_000),
      });
      if (response.ok) {
        await this.store.markDelivered(record.id);
        return;
      }
      reason = `http_${response.status}`;
    } catch {
      reason = "network_error";
    }

    const retryAt = new Date(this.now().getTime() + this.retryDelayMs(record.attempt));
    await this.store.markFailed(record.id, reason, retryAt);
    this.logger.error("[waitlist] delivery deferred", {
      attempt: record.attempt,
      reason,
      retryAt: retryAt.toISOString(),
      signupId: record.id,
    });
  }
}
