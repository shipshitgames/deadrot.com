import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

import type { WaitlistSignup } from "@/lib/waitlist";

// Intercept the side-effecting sink so the handler tests assert the capture
// contract (status codes + whether a signup is recorded) without touching the
// network or env. mock.module must be registered before the route is imported,
// so the route is pulled in lazily inside the tests via loadRoute().
const recorded: WaitlistSignup[] = [];
const recordSignup = mock(async (signup: WaitlistSignup) => {
  recorded.push(signup);
});

mock.module("@/lib/waitlist-sink", () => ({
  recordSignup,
  waitlistForwardTarget: () => null,
}));

async function loadRoute() {
  return import("@/app/api/waitlist/route");
}

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

beforeEach(() => {
  recorded.length = 0;
  recordSignup.mockClear();
});

// mock.module overrides are process-global in bun:test; restore so a sibling file
// (waitlist-sink.test.ts) can exercise the real sink without inheriting this mock.
afterAll(() => {
  mock.restore();
});

describe("POST /api/waitlist", () => {
  test("records a valid JSON signup and returns ok", async () => {
    const { POST } = await loadRoute();
    const res = await POST(jsonReq({ email: "Survivor@Deadrot.com", source: "site-waitlist" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(recordSignup).toHaveBeenCalledTimes(1);
    expect(recorded[0]?.email).toBe("survivor@deadrot.com");
    expect(recorded[0]?.source).toBe("site-waitlist");
    // The route stamps an ISO timestamp the pure layer never sees.
    expect(recorded[0]?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("accepts a progressive-enhancement form-encoded submit", async () => {
    const { POST } = await loadRoute();
    const res = await POST(formReq({ email: "a@b.co" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(recorded[0]?.email).toBe("a@b.co");
    // Source defaults when the form omits it.
    expect(recorded[0]?.source).toBe("site");
  });

  test("rejects an invalid email with 400 and never records", async () => {
    const { POST } = await loadRoute();
    const res = await POST(jsonReq({ email: "nope" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "Enter a valid email address." });
    expect(recordSignup).not.toHaveBeenCalled();
  });

  test("a tripped honeypot returns ok but records nothing (don't tip off the bot)", async () => {
    const { POST } = await loadRoute();
    const res = await POST(jsonReq({ email: "real@person.com", company: "Acme Corp" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(recordSignup).not.toHaveBeenCalled();
  });

  test("malformed JSON is treated as an invalid (empty) submit, not a 500", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      new Request("http://localhost/api/waitlist/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      }),
    );

    expect(res.status).toBe(400);
    expect(recordSignup).not.toHaveBeenCalled();
  });
});
