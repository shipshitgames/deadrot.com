import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { POST } from "@/app/api/waitlist/route";

// Exercises the POST handler end-to-end through the REAL sink (lib/waitlist-sink.ts):
// the first-party API is wired and globalThis.fetch is faked, so a durably accepted
// signup shows up as a JSON payload we can inspect. Deliberately uses NO mock.module —
// Bun's module mocks are process-global and can leak between sibling test files.

const PERSISTENCE = "https://api.deadrot.test/v1/waitlist";
let realFetch: typeof fetch;
const savedEnv: Record<string, string | undefined> = {};
let forwarded: Array<{ url: string; body: Record<string, unknown> }>;

beforeEach(() => {
  for (const key of ["WAITLIST_API_URL", "WAITLIST_API_TOKEN", "WAITLIST_LOCAL_FILE"] as const) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  process.env.WAITLIST_API_URL = PERSISTENCE;
  process.env.WAITLIST_API_TOKEN = "test-token";
  forwarded = [];
  realFetch = globalThis.fetch;
  globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
    forwarded.push({ url: String(url), body: JSON.parse(String(init?.body ?? "null")) });
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const key of ["WAITLIST_API_URL", "WAITLIST_API_TOKEN", "WAITLIST_LOCAL_FILE"] as const) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost/api/waitlist/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function formReq(fields: Record<string, string>): Request {
  const form = new URLSearchParams(fields);
  return new Request("http://localhost/api/waitlist/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
}

describe("POST /api/waitlist", () => {
  test("records a valid JSON signup (normalized + timestamped) and returns ok", async () => {
    const res = await POST(jsonReq({ email: "Survivor@Deadrot.com", source: "site-waitlist" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(forwarded).toHaveLength(1);
    expect(forwarded[0].url).toBe(PERSISTENCE);
    expect(forwarded[0].body).toMatchObject({ email: "survivor@deadrot.com", source: "site-waitlist" });
    // The route stamps an ISO timestamp the pure layer never sees.
    expect(String(forwarded[0].body.at)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("accepts a form-encoded submit from a non-JSON client", async () => {
    const res = await POST(formReq({ email: "a@b.co" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(forwarded[0].body).toMatchObject({ email: "a@b.co", source: "site" });
  });

  test("rejects an invalid email with 400 and never records", async () => {
    const res = await POST(jsonReq({ email: "nope" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "Enter a valid email address." });
    expect(forwarded).toHaveLength(0);
  });

  test("a tripped honeypot returns ok but records nothing (don't tip off the bot)", async () => {
    const res = await POST(jsonReq({ email: "real@person.com", company: "Acme Corp" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(forwarded).toHaveLength(0);
  });

  test("malformed JSON is treated as an invalid (empty) submit, not a 500", async () => {
    const res = await POST(
      new Request("http://localhost/api/waitlist/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      }),
    );

    expect(res.status).toBe(400);
    expect(forwarded).toHaveLength(0);
  });

  test("unavailable persistence returns a retryable 503 and never claims success", async () => {
    globalThis.fetch = mock(async () => new Response(null, { status: 500 })) as unknown as typeof fetch;

    const res = await POST(jsonReq({ email: "survivor@deadrot.com" }));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      ok: false,
      error: "We couldn't save your signup. Please try again.",
    });
  });
});
