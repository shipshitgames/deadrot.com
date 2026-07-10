import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { WarlineClient } from "./client";
import type { OperationResult } from "./types";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function operation(nonce?: string): OperationResult {
  return {
    game: "scourge-survivors",
    faction: "pyre",
    outcome: "victory",
    score: 100,
    nonce,
  };
}

test("reportOperation refuses to write without a server reporter identity", async () => {
  let fetched = false;
  globalThis.fetch = (async () => {
    fetched = true;
    throw new Error("unexpected fetch");
  }) as typeof fetch;

  const response = await new WarlineClient({ host: "warline.test" }).reportOperation(operation("nonce-1234567890"));
  assert.equal(response.ok, false);
  assert.match(response.error ?? "", /server reporter identity required/);
  assert.equal(fetched, false);
});

test("server reporters send identity, replay headers, and the server-only bearer", async () => {
  let captured: { url?: string; init?: RequestInit } = {};
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const nonce = "nonce-1234567890";
  const client = new WarlineClient({
    host: "warline.test",
    reporter: {
      id: "web-broker",
      token: "server-only-token-at-least-32-characters",
      subject: "user_test_123",
    },
  });
  const response = await client.reportOperation(operation(nonce));
  assert.equal(response.ok, true);
  assert.match(captured.url ?? "", /\/parties\/main\/front$/);

  const headers = new Headers(captured.init?.headers);
  assert.equal(headers.get("x-warline-reporter"), "web-broker");
  assert.equal(headers.get("x-warline-subject"), "user_test_123");
  assert.equal(headers.get("x-warline-request-id"), nonce);
  assert.match(headers.get("authorization") ?? "", /^Bearer server-only-/);
  assert.ok(Number(headers.get("x-warline-timestamp")) > 0);
});

test("server reporters must provide a stable operation nonce", async () => {
  const client = new WarlineClient({
    host: "warline.test",
    reporter: { id: "web-broker", token: "secret", subject: "user_test_123" },
  });
  const response = await client.reportOperation(operation());
  assert.equal(response.ok, false);
  assert.match(response.error ?? "", /nonce required/);
});
