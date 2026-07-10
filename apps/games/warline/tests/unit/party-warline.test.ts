import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import type * as Party from "partykit/server";
import { REPORT_LIMIT } from "../../party/trust";
import Warline from "../../party/warline";

const REPORTER_TOKEN = "reporter-token-that-is-at-least-32-characters";
const ADMIN_TOKEN = "administrator-token-at-least-32-characters";
const REPORTER_ID = "web-broker";
const SUBJECT = "user_test_123";
const NONCE = "12345678-1234-4123-8123-123456789abc";

class MemoryStorage {
  data = new Map<string, unknown>();
  alarm: number | null = null;

  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.data.set(key, structuredClone(value));
  }

  async delete(keyOrKeys: string | string[]): Promise<boolean | number> {
    if (Array.isArray(keyOrKeys)) {
      let count = 0;
      for (const key of keyOrKeys) if (this.data.delete(key)) count++;
      return count;
    }
    return this.data.delete(keyOrKeys);
  }

  async list<T>({ prefix = "", limit = 1_000 }: { prefix?: string; limit?: number } = {}): Promise<Map<string, T>> {
    return new Map(
      [...this.data.entries()].filter(([key]) => key.startsWith(prefix)).slice(0, limit) as Array<[string, T]>,
    );
  }

  async transaction<T>(fn: (txn: MemoryStorage) => Promise<T>): Promise<T> {
    const original = this.data;
    const staged = new Map([...original.entries()].map(([key, value]) => [key, structuredClone(value)]));
    this.data = staged;
    try {
      return await fn(this);
    } catch (error) {
      this.data = original;
      throw error;
    }
  }

  async getAlarm(): Promise<number | null> {
    return this.alarm;
  }

  async setAlarm(value: number): Promise<void> {
    this.alarm = value;
  }
}

interface TestRoom {
  env: Record<string, unknown>;
  storage: MemoryStorage;
  broadcasts: string[];
  broadcast: (message: string) => void;
}

function makeRoom(env: Record<string, unknown> = {}, storage = new MemoryStorage()): TestRoom {
  const room: TestRoom = {
    env,
    storage,
    broadcasts: [],
    broadcast: (message) => room.broadcasts.push(message),
  };
  return room;
}

function registry(games = ["scourge-survivors"]): string {
  return JSON.stringify({ [REPORTER_ID]: { token: REPORTER_TOKEN, games } });
}

function reportBody(overrides: Record<string, unknown> = {}) {
  return {
    type: "report",
    result: {
      game: "scourge-survivors",
      faction: "pyre",
      outcome: "victory",
      score: 1200,
      nonce: NONCE,
      contributed: 50,
      ...overrides,
    },
  };
}

function mutationHeaders(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    authorization: `Bearer ${REPORTER_TOKEN}`,
    "content-type": "application/json",
    "x-warline-reporter": REPORTER_ID,
    "x-warline-subject": SUBJECT,
    "x-warline-request-id": NONCE,
    "x-warline-timestamp": String(Date.now()),
    ...overrides,
  };
}

function request(body: unknown, headers = mutationHeaders()): Request {
  return new Request("https://warline.test/parties/main/front", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

let room: TestRoom;
let server: Warline;

beforeEach(async () => {
  room = makeRoom({ WARLINE_REPORTERS: registry(), WARLINE_ADMIN_TOKEN: ADMIN_TOKEN });
  server = new Warline(room as unknown as Party.Room);
  await server.onStart();
});

test("reports and resets fail closed when server secrets are absent", async () => {
  const closedRoom = makeRoom();
  const closed = new Warline(closedRoom as unknown as Party.Room);
  await closed.onStart();

  const report = await closed.onRequest(request(reportBody()));
  assert.equal(report.status, 503);

  const reset = await closed.onRequest(
    request(
      { type: "reset" },
      mutationHeaders({ authorization: `Bearer ${ADMIN_TOKEN}`, "x-warline-request-id": NONCE }),
    ),
  );
  assert.equal(reset.status, 503);
  assert.equal(closed.state.epoch, 1);
  assert.equal(closed.state.feed.length, 0);
});

test("reporter identity, credential, and game authorization are enforced", async () => {
  const wrongToken = await server.onRequest(request(reportBody(), mutationHeaders({ authorization: "Bearer wrong" })));
  assert.equal(wrongToken.status, 401);

  const wrongGame = await server.onRequest(request(reportBody({ game: "deadlane" }), mutationHeaders()));
  assert.equal(wrongGame.status, 403);
  assert.equal(server.state.feed.length, 0);
});

test("strict report validation rejects spoofable, non-finite, mismatched, and stale claims", async () => {
  const actor = await server.onRequest(request(reportBody({ player: "spoof" })));
  assert.equal(actor.status, 400);

  const target = await server.onRequest(request(reportBody({ targetId: "breach-primus" })));
  assert.equal(target.status, 400);

  const score = await server.onRequest(request(reportBody({ score: -1 })));
  assert.equal(score.status, 400);

  const nonce = await server.onRequest(request(reportBody({ nonce: "different-valid-nonce-123" })));
  assert.equal(nonce.status, 400);

  const stale = await server.onRequest(
    request(reportBody(), mutationHeaders({ "x-warline-timestamp": String(Date.now() - 10 * 60_000) })),
  );
  assert.equal(stale.status, 409);
  assert.equal(server.state.feed.length, 0);
});

test("accepted reports mutate once and exact retries use a durable receipt", async () => {
  const first = await server.onRequest(request(reportBody()));
  assert.equal(first.status, 200);
  assert.equal((await bodyOf(first)).ok, true);
  assert.equal(server.state.feed.length, 1);
  assert.equal(room.broadcasts.length, 1);

  const retry = await server.onRequest(request(reportBody()));
  assert.equal(retry.status, 200);
  assert.equal((await bodyOf(retry)).idempotent, true);
  assert.equal(server.state.feed.length, 1);
  assert.equal(room.broadcasts.length, 1);

  const restartedRoom = makeRoom(room.env, room.storage);
  const restarted = new Warline(restartedRoom as unknown as Party.Room);
  await restarted.onStart();
  const afterRestart = await restarted.onRequest(request(reportBody()));
  assert.equal((await bodyOf(afterRestart)).idempotent, true);
  assert.equal(restarted.state.feed.length, 1);
  assert.equal(restartedRoom.broadcasts.length, 0);
});

test("reusing a nonce for different content conflicts without a second mutation", async () => {
  assert.equal((await server.onRequest(request(reportBody()))).status, 200);
  const conflict = await server.onRequest(request(reportBody({ score: 1201 })));
  assert.equal(conflict.status, 409);
  assert.equal(server.state.feed.length, 1);
});

test("per-subject report rate limits return Retry-After without mutation", async () => {
  await room.storage.put("rate:report:web-broker:user_test_123", {
    startedAt: Date.now(),
    count: REPORT_LIMIT,
  });
  const response = await server.onRequest(
    request(
      reportBody({ nonce: "rate-limit-nonce-123456" }),
      mutationHeaders({
        "x-warline-request-id": "rate-limit-nonce-123456",
      }),
    ),
  );
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get("retry-after")) >= 1);
  assert.equal(server.state.feed.length, 0);
});

test("anonymous WebSocket/HTTP demo and command messages never mutate the authoritative world", async () => {
  const sent: string[] = [];
  const conn = { id: "browser", send: (message: string) => sent.push(message) } as unknown as Party.Connection;
  server.onMessage(JSON.stringify({ t: "sim", game: "scourge-survivors" }), conn);
  server.onMessage(JSON.stringify({ t: "command", command: { kind: "muster", faction: "pyre" } }), conn);
  server.onMessage(JSON.stringify({ t: "reset", token: ADMIN_TOKEN }), conn);
  assert.equal(sent.length, 3);
  assert.ok(sent.every((message) => JSON.parse(message).ok === false));

  const http = await server.onRequest(request({ type: "command", command: { kind: "muster", faction: "pyre" } }));
  assert.equal(http.status, 403);
  assert.equal(server.state.feed.length, 0);
  assert.equal(room.broadcasts.length, 0);
});

test("admin reset is authenticated, idempotent, and never accepted from a browser token message", async () => {
  const headers = mutationHeaders({ authorization: `Bearer ${ADMIN_TOKEN}`, "x-warline-request-id": NONCE });
  const reset = await server.onRequest(request({ type: "reset" }, headers));
  assert.equal(reset.status, 200);
  assert.equal(server.state.epoch, 2);
  assert.equal(room.broadcasts.length, 1);

  const retry = await server.onRequest(request({ type: "reset" }, headers));
  assert.equal((await bodyOf(retry)).idempotent, true);
  assert.equal(server.state.epoch, 2);
  assert.equal(room.broadcasts.length, 1);

  const wrong = await server.onRequest(
    request(
      { type: "reset" },
      mutationHeaders({ authorization: "Bearer wrong", "x-warline-request-id": "wrong-reset-nonce-12345" }),
    ),
  );
  assert.equal(wrong.status, 401);
  assert.equal(server.state.epoch, 2);
});
