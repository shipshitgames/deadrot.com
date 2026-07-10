import { describe, expect, mock, test } from "bun:test";

import {
  type RecordResult,
  WaitlistOutbox,
  type WaitlistRecord,
  type WaitlistSignup,
  type WaitlistStore,
} from "../../src/waitlist";

class OutboxStore implements WaitlistStore {
  recordValue: WaitlistRecord = {
    at: "2026-07-09T12:00:00.000Z",
    attempt: 0,
    email: "private@example.com",
    id: "42",
    source: "site",
  };
  availableAt = 0;
  delivered = false;
  failures: Array<{ availableAt: Date; reason: string }> = [];
  now = 0;

  async claimPending(): Promise<WaitlistRecord[]> {
    if (this.delivered || this.availableAt > this.now) return [];
    this.recordValue.attempt += 1;
    return [{ ...this.recordValue }];
  }

  async markDelivered(): Promise<void> {
    this.delivered = true;
  }

  async markFailed(_id: string, reason: string, availableAt: Date): Promise<void> {
    this.availableAt = availableAt.getTime();
    this.failures.push({ availableAt, reason });
  }

  async record(_signup: WaitlistSignup): Promise<RecordResult> {
    return { created: true, id: "42" };
  }
}

describe("WaitlistOutbox", () => {
  for (const status of [400, 500]) {
    test(`keeps a ${status} sink response pending for retry`, async () => {
      const store = new OutboxStore();
      const logs: unknown[][] = [];
      const outbox = new WaitlistOutbox(store, "https://sink.example.com/waitlist", {
        fetchImpl: mock(async () => new Response(null, { status })) as unknown as typeof fetch,
        logger: { error: (...args: unknown[]) => logs.push(args) },
        now: () => new Date(store.now),
        retryDelayMs: () => 1_000,
      });

      await outbox.flush();

      expect(store.delivered).toBe(false);
      expect(store.failures[0]?.reason).toBe(`http_${status}`);
      expect(store.availableAt).toBe(1_000);
      expect(JSON.stringify(logs)).not.toContain("private@example.com");
    });
  }

  test("keeps a network failure pending without logging the address", async () => {
    const store = new OutboxStore();
    const logs: unknown[][] = [];
    const outbox = new WaitlistOutbox(store, "https://sink.example.com/waitlist", {
      fetchImpl: mock(async () => {
        throw new Error("network down for private@example.com");
      }) as unknown as typeof fetch,
      logger: { error: (...args: unknown[]) => logs.push(args) },
      now: () => new Date(store.now),
      retryDelayMs: () => 1_000,
    });

    await outbox.flush();

    expect(store.failures[0]?.reason).toBe("network_error");
    expect(JSON.stringify(logs)).not.toContain("private@example.com");
  });

  test("retries a deferred record and marks it delivered after recovery", async () => {
    const store = new OutboxStore();
    const fetchMock = mock()
      .mockImplementationOnce(async () => new Response(null, { status: 500 }))
      .mockImplementationOnce(async () => new Response(null, { status: 204 }));
    const outbox = new WaitlistOutbox(store, "https://sink.example.com/waitlist", {
      fetchImpl: fetchMock as unknown as typeof fetch,
      logger: { error: () => undefined },
      now: () => new Date(store.now),
      retryDelayMs: () => 1_000,
    });

    await outbox.flush();
    expect(store.delivered).toBe(false);
    store.now = 1_000;
    await outbox.flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(store.delivered).toBe(true);
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("deadrot-waitlist-42");
  });

  test("leaves the durable outbox untouched when no forward sink is configured", async () => {
    const store = new OutboxStore();
    const outbox = new WaitlistOutbox(store, undefined);
    expect(await outbox.flush()).toBe(0);
    expect(store.recordValue.attempt).toBe(0);
  });
});
