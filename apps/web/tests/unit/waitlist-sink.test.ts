import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { WaitlistSignup } from "@/lib/waitlist";

// Covers the only side-effecting layer (lib/waitlist-sink.ts). The sink reads its
// forward target from env at call time, so each test wires env + a fake fetch and
// asserts how a signup is forwarded — including that a non-ok HTTP reply is logged
// rather than silently dropped (the high-severity review finding for #355). The
// route is imported lazily via dynamic import so the sibling route test's global
// mock.module (restored in its afterAll) never binds into this file.

const signup: WaitlistSignup = {
  email: "real@person.com",
  source: "site",
  at: "2026-01-01T00:00:00.000Z",
};

const ENV_KEYS = ["WAITLIST_FORWARD_URL", "FORMSPREE_ID", "NEXT_PUBLIC_FORMSPREE_ID"] as const;
const savedEnv: Record<string, string | undefined> = {};
let realFetch: typeof fetch;
let realError: typeof console.error;
let realInfo: typeof console.info;

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  realFetch = globalThis.fetch;
  realError = console.error;
  realInfo = console.info;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  globalThis.fetch = realFetch;
  console.error = realError;
  console.info = realInfo;
});

async function loadSink() {
  return import("@/lib/waitlist-sink");
}

describe("recordSignup", () => {
  test("forwards to WAITLIST_FORWARD_URL and stays quiet on a 2xx", async () => {
    process.env.WAITLIST_FORWARD_URL = "https://example.test/hook";
    const fetchMock = mock(async () => new Response(null, { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const errors: unknown[][] = [];
    console.error = ((...args: unknown[]) => {
      errors.push(args);
    }) as typeof console.error;

    const { recordSignup } = await loadSink();
    await recordSignup(signup);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.test/hook");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "real@person.com",
      source: "site",
      at: "2026-01-01T00:00:00.000Z",
    });
    expect(errors).toHaveLength(0);
  });

  test("logs a non-ok forward reply instead of dropping it silently", async () => {
    process.env.WAITLIST_FORWARD_URL = "https://example.test/hook";
    globalThis.fetch = mock(async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;
    const errors: unknown[][] = [];
    console.error = ((...args: unknown[]) => {
      errors.push(args);
    }) as typeof console.error;

    const { recordSignup } = await loadSink();
    await recordSignup(signup);

    expect(errors).toHaveLength(1);
    expect(String(errors[0][0])).toContain("non-ok");
    expect(errors[0][1]).toMatchObject({ status: 500, source: "site" });
  });

  test("a transport outage is swallowed (never throws) and logged", async () => {
    process.env.WAITLIST_FORWARD_URL = "https://example.test/hook";
    globalThis.fetch = mock(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const errors: unknown[][] = [];
    console.error = ((...args: unknown[]) => {
      errors.push(args);
    }) as typeof console.error;

    const { recordSignup } = await loadSink();
    await expect(recordSignup(signup)).resolves.toBeUndefined();
    expect(errors).toHaveLength(1);
    expect(String(errors[0][0])).toContain("forward failed");
  });

  test("FORMSPREE_ID resolves to the formspree endpoint when no forward url is set", async () => {
    process.env.FORMSPREE_ID = "abc123";
    const fetchMock = mock(async () => new Response(null, { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { recordSignup } = await loadSink();
    await recordSignup(signup);

    expect((fetchMock.mock.calls[0] as [string, RequestInit])[0]).toBe("https://formspree.io/f/abc123");
  });

  test("with no sink wired it structured-logs source+at and never the raw email", async () => {
    const fetchMock = mock(async () => new Response(null, { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const infos: unknown[][] = [];
    console.info = ((...args: unknown[]) => {
      infos.push(args);
    }) as typeof console.info;

    const { recordSignup } = await loadSink();
    await recordSignup(signup);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(infos).toHaveLength(1);
    expect(infos[0][1]).toEqual({ source: "site", at: "2026-01-01T00:00:00.000Z" });
    // Privacy: the fallback log must never carry the raw address.
    expect(JSON.stringify(infos[0])).not.toContain("real@person.com");
  });
});
