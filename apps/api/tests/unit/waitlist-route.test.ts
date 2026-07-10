import { describe, expect, test } from "bun:test";

import { createRequestHandler } from "../../src/app";
import type { ApiConfig } from "../../src/config";
import type { RecordResult, WaitlistSignup, WaitlistStore } from "../../src/waitlist";

const config: ApiConfig = {
  allowedOrigins: ["https://deadrot.com"],
  cdnOrigin: "https://cdn.deadrot.com",
  databaseSslMode: "disable",
  databaseUrl: "postgres://configured",
  host: "127.0.0.1",
  nodeEnv: "production",
  port: 3004,
  serviceName: "deadrot-api-test",
  waitlistIngestToken: "test-ingest-token",
};

class MemoryStore implements WaitlistStore {
  readonly records = new Map<string, WaitlistSignup>();
  fail = false;

  async record(signup: WaitlistSignup): Promise<RecordResult> {
    if (this.fail) throw new Error("database unavailable");
    const created = !this.records.has(signup.email);
    if (created) this.records.set(signup.email, signup);
    return { created, id: "1" };
  }

  async claimPending() {
    return [];
  }

  async markDelivered() {}

  async markFailed() {}
}

function request(email = "Survivor@Deadrot.com", token = "test-ingest-token"): Request {
  return new Request("https://api.deadrot.com/v1/waitlist", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ at: "2026-07-09T12:00:00.000Z", email, source: "site-waitlist" }),
  });
}

describe("POST /v1/waitlist", () => {
  test("durably records before returning success and normalizes the address", async () => {
    const store = new MemoryStore();
    const route = createRequestHandler(config, { waitlistStore: store });

    const response = await route(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ created: true, ok: true });
    expect(store.records.get("survivor@deadrot.com")).toMatchObject({ source: "site-waitlist" });
  });

  test("duplicate signup is idempotent", async () => {
    const store = new MemoryStore();
    const route = createRequestHandler(config, { waitlistStore: store });

    expect(await (await route(request())).json()).toEqual({ created: true, ok: true });
    expect(await (await route(request("survivor@deadrot.com"))).json()).toEqual({ created: false, ok: true });
    expect(store.records.size).toBe(1);
  });

  test("unavailable persistence returns 503 and never claims success", async () => {
    const store = new MemoryStore();
    store.fail = true;
    const route = createRequestHandler(config, { waitlistStore: store });

    const response = await route(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: "persistence_unavailable" } });
  });

  test("rejects an invalid token before touching persistence", async () => {
    const store = new MemoryStore();
    const route = createRequestHandler(config, { waitlistStore: store });

    const response = await route(request("survivor@deadrot.com", "wrong-token"));

    expect(response.status).toBe(401);
    expect(store.records.size).toBe(0);
  });

  test("missing production ingest config fails closed", async () => {
    const route = createRequestHandler(
      { ...config, waitlistIngestToken: undefined },
      { waitlistStore: new MemoryStore() },
    );
    const response = await route(request());
    expect(response.status).toBe(503);
  });
});
