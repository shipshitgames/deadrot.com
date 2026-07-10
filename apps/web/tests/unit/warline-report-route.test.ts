import { describe, expect, test } from "bun:test";
import type { PlayableGameSlug } from "@deadrot/catalog";

import {
  createWarlineReportHandler,
  readWarlineBrokerConfig,
  type WarlineAuthorization,
  type WarlineBrokerConfig,
} from "@/lib/warline-report";

const FRONT = "https://warline.test/parties/main/front";
const CONFIG: WarlineBrokerConfig = {
  frontUrl: FRONT,
  reporterId: "deadrot-web",
  reporterToken: "server-only-test-token",
};
const NOW = Date.parse("2026-07-09T12:34:56.000Z");
const RESULT = {
  game: "scourge-survivors",
  faction: "pyre",
  outcome: "victory",
  score: 1200,
  nonce: "7cdb1907-ec12-45e6-a367-bf34d56569ca",
};
const REPORTING_GAMES = ["scourge-survivors", "deadlane", "pactfall", "brawl", "starblight", "redline", "rothulk"];

function isReportingGame(value: unknown): value is PlayableGameSlug {
  return typeof value === "string" && REPORTING_GAMES.includes(value);
}

interface ForwardedRequest {
  url: string;
  init: RequestInit;
}

function request(body: unknown, contentType = "application/json"): Request {
  return new Request("https://deadrot.com/api/warline/report", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: JSON.stringify(body),
  });
}

function setup(options?: {
  authorization?: WarlineAuthorization;
  config?: WarlineBrokerConfig | null;
  upstream?: Response;
}) {
  const forwarded: ForwardedRequest[] = [];
  const handler = createWarlineReportHandler({
    authorizeGame: async () => options?.authorization ?? { status: "allowed", userId: "user_server_123" },
    config: () => (options && "config" in options ? (options.config ?? null) : CONFIG),
    fetch: (async (url: string | URL | Request, init?: RequestInit) => {
      forwarded.push({ url: String(url), init: init ?? {} });
      return options?.upstream ?? Response.json({ ok: true, internal: "not proxied" });
    }) as typeof fetch,
    isReportingGame,
    now: () => NOW,
  });
  return { handler, forwarded };
}

describe("POST /api/warline/report", () => {
  test("rejects malformed top-level input before authentication or forwarding", async () => {
    let authCalls = 0;
    const handler = createWarlineReportHandler({
      authorizeGame: async () => {
        authCalls += 1;
        return { status: "allowed", userId: "user_server_123" };
      },
      config: () => CONFIG,
      fetch: async () => Response.json({ ok: true }),
      isReportingGame,
      now: () => NOW,
    });

    const response = await handler(request({ type: "report", result: RESULT }));

    expect(response.status).toBe(400);
    expect(authCalls).toBe(0);
  });

  test("rejects a signed-out caller and never forwards", async () => {
    const { handler, forwarded } = setup({ authorization: { status: "signed-out" } });

    const response = await handler(request({ result: RESULT }));

    expect(response.status).toBe(401);
    expect(forwarded).toHaveLength(0);
  });

  test("fails closed when the Clerk identity provider is unavailable", async () => {
    const { handler, forwarded } = setup({ authorization: { status: "unavailable" } });

    const response = await handler(request({ result: RESULT }));

    expect(response.status).toBe(503);
    expect(forwarded).toHaveLength(0);
  });

  test("fails closed when the server-only broker configuration is missing", async () => {
    const { handler, forwarded } = setup({ config: null });

    const response = await handler(request({ result: RESULT }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "Warline reporting is unavailable" });
    expect(forwarded).toHaveLength(0);
  });

  test("rejects a caller without access to the requested game", async () => {
    const { handler, forwarded } = setup({ authorization: { status: "denied" } });
    const lockedResult = { ...RESULT, game: "rothulk" };

    const response = await handler(request({ result: lockedResult }));

    expect(response.status).toBe(403);
    expect(forwarded).toHaveLength(0);
  });

  test("forwards with server identity headers and strips browser identity/target spoofing", async () => {
    const { handler, forwarded } = setup();
    const response = await handler(
      request({
        result: {
          ...RESULT,
          contributed: 250,
          player: "spoofed-admin",
          targetId: "breach-primus",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(forwarded).toHaveLength(1);
    expect(forwarded[0]?.url).toBe(FRONT);

    const headers = new Headers(forwarded[0]?.init.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${CONFIG.reporterToken}`);
    expect(headers.get("x-warline-reporter")).toBe(CONFIG.reporterId);
    expect(headers.get("x-warline-subject")).toBe("user_server_123");
    expect(headers.get("x-warline-request-id")).toBe(RESULT.nonce);
    expect(headers.get("x-warline-timestamp")).toBe("2026-07-09T12:34:56.000Z");

    const body = JSON.parse(String(forwarded[0]?.init.body));
    expect(body).toEqual({
      type: "report",
      result: { ...RESULT, contributed: 250 },
    });
    expect(body.result.player).toBeUndefined();
    expect(body.result.targetId).toBeUndefined();
  });

  test("requires a bounded request nonce", async () => {
    const { handler, forwarded } = setup();

    const response = await handler(request({ result: { ...RESULT, nonce: "short" } }));

    expect(response.status).toBe(400);
    expect(forwarded).toHaveLength(0);
  });

  test("does not reflect an upstream body or server credential into an error response", async () => {
    const { handler } = setup({
      upstream: Response.json({ ok: false, detail: CONFIG.reporterToken }, { status: 401 }),
    });

    const response = await handler(request({ result: RESULT }));
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(text).not.toContain(CONFIG.reporterToken);
    expect(text).not.toContain("detail");
  });
});

describe("readWarlineBrokerConfig", () => {
  test("requires all server-only values and resolves a bare PartyKit host over HTTPS", () => {
    expect(readWarlineBrokerConfig({})).toBeNull();
    expect(
      readWarlineBrokerConfig({
        WARLINE_HOST: "warline.example.partykit.dev",
        WARLINE_REPORTER_ID: "deadrot-web",
        WARLINE_REPORTER_TOKEN: "server-only-token",
      }),
    ).toEqual({
      frontUrl: "https://warline.example.partykit.dev/parties/main/front",
      reporterId: "deadrot-web",
      reporterToken: "server-only-token",
    });
  });

  test("rejects invalid protocols and header-breaking reporter values", () => {
    expect(
      readWarlineBrokerConfig({
        WARLINE_HOST: "file://local-secret",
        WARLINE_REPORTER_ID: "deadrot-web",
        WARLINE_REPORTER_TOKEN: "server-only-token",
      }),
    ).toBeNull();
    expect(
      readWarlineBrokerConfig({
        WARLINE_HOST: "warline.example.partykit.dev",
        WARLINE_REPORTER_ID: "deadrot-web",
        WARLINE_REPORTER_TOKEN: "bad\nheader",
      }),
    ).toBeNull();
  });
});
