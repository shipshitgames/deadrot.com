import { describe, expect, mock, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WaitlistSignup } from "@/lib/waitlist";
import { recordSignup, WaitlistPersistenceError } from "@/lib/waitlist-sink";

const signup: WaitlistSignup = {
  email: "real@person.com",
  source: "site",
  at: "2026-01-01T00:00:00.000Z",
};

const configuredEnv = {
  NODE_ENV: "production",
  VERCEL_ENV: "production",
  WAITLIST_API_TOKEN: "test-token",
  WAITLIST_API_URL: "https://api.deadrot.test/v1/waitlist",
};

describe("recordSignup", () => {
  test("sends the normalized record to first-party persistence", async () => {
    const fetchMock = mock(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await recordSignup(signup, configuredEnv, fetchMock as unknown as typeof fetch);

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.href).toBe("https://api.deadrot.test/v1/waitlist");
    expect(init.headers).toMatchObject({ Authorization: "Bearer test-token" });
    expect(JSON.parse(String(init.body))).toEqual(signup);
  });

  for (const status of [400, 500]) {
    test(`rejects when persistence returns ${status}`, async () => {
      const fetchMock = mock(async () => new Response(null, { status }));
      await expect(recordSignup(signup, configuredEnv, fetchMock as unknown as typeof fetch)).rejects.toBeInstanceOf(
        WaitlistPersistenceError,
      );
    });
  }

  test("rejects on a persistence network failure", async () => {
    const fetchMock = mock(async () => {
      throw new Error("network down");
    });
    await expect(recordSignup(signup, configuredEnv, fetchMock as unknown as typeof fetch)).rejects.toBeInstanceOf(
      WaitlistPersistenceError,
    );
  });

  test("rejects when required production persistence config is missing", async () => {
    await expect(recordSignup(signup, { NODE_ENV: "production", VERCEL_ENV: "production" })).rejects.toBeInstanceOf(
      WaitlistPersistenceError,
    );
  });

  test("supports an explicit fsynced local/E2E file but never in production", async () => {
    const dir = await mkdtemp(join(tmpdir(), "deadrot-waitlist-test-"));
    const path = join(dir, "signups.jsonl");

    await recordSignup(signup, { NODE_ENV: "test", WAITLIST_LOCAL_FILE: path });
    expect(JSON.parse((await readFile(path, "utf8")).trim())).toEqual(signup);
    await expect(
      recordSignup(signup, { NODE_ENV: "production", VERCEL_ENV: "production", WAITLIST_LOCAL_FILE: path }),
    ).rejects.toBeInstanceOf(WaitlistPersistenceError);
  });
});
