import type { PlayableGameSlug } from "@deadrot/catalog";

const MAX_REPORT_BYTES = 8 * 1024;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const RESULT_KEYS = new Set(["game", "faction", "outcome", "score", "nonce", "contributed", "player", "targetId"]);

type HumanFaction = "pyre" | "wardens";
type OperationOutcome = "victory" | "defeat";

export interface BrokeredOperationResult {
  game: PlayableGameSlug;
  faction: HumanFaction;
  outcome: OperationOutcome;
  score: number;
  nonce: string;
  contributed?: number;
}

export interface WarlineBrokerConfig {
  frontUrl: string;
  reporterId: string;
  reporterToken: string;
}

export type WarlineAuthorization =
  | { status: "allowed"; userId: string }
  | { status: "signed-out" }
  | { status: "denied" }
  | { status: "unavailable" };

export interface WarlineReportDependencies {
  authorizeGame: (game: PlayableGameSlug) => Promise<WarlineAuthorization>;
  config: () => WarlineBrokerConfig | null;
  fetch: typeof fetch;
  isReportingGame: (value: unknown) => value is PlayableGameSlug;
  now: () => number;
}

type ParseResult = { ok: true; result: BrokeredOperationResult } | { ok: false; status: number; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

async function parseReportRequest(
  req: Request,
  isReportingGame: WarlineReportDependencies["isReportingGame"],
): Promise<ParseResult> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, status: 415, error: "Expected an application/json report" };
  }

  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REPORT_BYTES) {
    return { ok: false, status: 413, error: "Report is too large" };
  }

  const text = await req.text().catch(() => "");
  if (new TextEncoder().encode(text).byteLength > MAX_REPORT_BYTES) {
    return { ok: false, status: 413, error: "Report is too large" };
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, status: 400, error: "Malformed report" };
  }

  if (!isRecord(body) || Object.keys(body).length !== 1 || !("result" in body) || !isRecord(body.result)) {
    return { ok: false, status: 400, error: "Malformed report" };
  }

  const raw = body.result;
  if (Object.keys(raw).some((key) => !RESULT_KEYS.has(key))) {
    return { ok: false, status: 400, error: "Malformed report" };
  }
  if (!isReportingGame(raw.game)) {
    return { ok: false, status: 400, error: "Unknown reporting game" };
  }
  if (raw.faction !== "pyre" && raw.faction !== "wardens") {
    return { ok: false, status: 400, error: "Invalid faction" };
  }
  if (raw.outcome !== "victory" && raw.outcome !== "defeat") {
    return { ok: false, status: 400, error: "Invalid outcome" };
  }
  if (!isFiniteNonNegative(raw.score)) {
    return { ok: false, status: 400, error: "Invalid score" };
  }
  if (typeof raw.nonce !== "string" || !NONCE_PATTERN.test(raw.nonce)) {
    return { ok: false, status: 400, error: "Invalid report nonce" };
  }
  if (raw.contributed !== undefined && !isFiniteNonNegative(raw.contributed)) {
    return { ok: false, status: 400, error: "Invalid contribution" };
  }

  // The browser does not own identity or targeting. Build a fresh allowlisted
  // object so player/targetId (and object identity/prototype) cannot cross the
  // server-side trust boundary.
  const result: BrokeredOperationResult = {
    game: raw.game,
    faction: raw.faction,
    outcome: raw.outcome,
    score: raw.score,
    nonce: raw.nonce,
  };
  if (raw.contributed !== undefined) result.contributed = raw.contributed;
  return { ok: true, result };
}

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * Dependency-injected core for the Next Route Handler. Keeping framework I/O at
 * the edge makes every fail-closed branch testable without process-global Clerk
 * module mocks.
 */
export function createWarlineReportHandler(deps: WarlineReportDependencies) {
  return async function POST(req: Request): Promise<Response> {
    const parsed = await parseReportRequest(req, deps.isReportingGame);
    if (!parsed.ok) return json({ ok: false, error: parsed.error }, parsed.status);

    const authorization = await deps.authorizeGame(parsed.result.game).catch(() => ({
      status: "unavailable" as const,
    }));
    if (authorization.status === "signed-out") {
      return json({ ok: false, error: "Sign in to report this operation" }, 401);
    }
    if (authorization.status === "denied") {
      return json({ ok: false, error: "This account cannot report that game" }, 403);
    }
    if (authorization.status === "unavailable") {
      return json({ ok: false, error: "Warline identity is unavailable" }, 503);
    }
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(authorization.userId)) {
      return json({ ok: false, error: "Warline identity is unavailable" }, 503);
    }

    const config = deps.config();
    if (!config) {
      return json({ ok: false, error: "Warline reporting is unavailable" }, 503);
    }

    const headers = new Headers({
      Authorization: `Bearer ${config.reporterToken}`,
      "Content-Type": "application/json",
      "X-Warline-Reporter": config.reporterId,
      "X-Warline-Subject": authorization.userId,
      "X-Warline-Request-Id": parsed.result.nonce,
      "X-Warline-Timestamp": String(deps.now()),
    });

    let upstream: Response;
    try {
      upstream = await deps.fetch(config.frontUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ type: "report", result: parsed.result }),
        cache: "no-store",
      });
    } catch {
      return json({ ok: false, error: "Warline is unavailable" }, 502);
    }

    if (!upstream.ok) {
      const status =
        upstream.status === 429 ? 429 : upstream.status === 409 ? 409 : upstream.status === 400 ? 400 : 502;
      return json(
        { ok: false, error: status === 429 ? "Too many Warline reports" : "Warline rejected the report" },
        status,
      );
    }

    // The game reporter needs only acceptance. Do not proxy arbitrary upstream
    // bodies back into the browser response, where an accidental internal detail
    // could become a disclosure.
    return json({ ok: true });
  };
}

function hasHeaderBreak(value: string): boolean {
  return value.includes("\r") || value.includes("\n");
}

/** Resolve and validate the three server-only settings. Missing/bad config fails closed. */
export function readWarlineBrokerConfig(env: NodeJS.ProcessEnv = process.env): WarlineBrokerConfig | null {
  const host = env.WARLINE_HOST?.trim();
  const reporterId = env.WARLINE_REPORTER_ID?.trim();
  const reporterToken = env.WARLINE_REPORTER_TOKEN?.trim();
  if (!host || !reporterId || !reporterToken) return null;
  if (hasHeaderBreak(reporterId) || hasHeaderBreak(reporterToken)) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(reporterId)) return null;
  if (reporterToken.length < 32 || reporterToken.length > 512 || !/^[\x21-\x7e]+$/.test(reporterToken)) return null;

  const hasProtocol = /^https?:\/\//i.test(host);
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(host) && !hasProtocol) return null;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(?::|$)/i.test(host);
  let front: URL;
  try {
    front = new URL(hasProtocol ? host : `${local ? "http" : "https"}://${host}`);
  } catch {
    return null;
  }
  if ((front.protocol !== "https:" && front.protocol !== "http:") || front.username || front.password) return null;
  front.pathname = "/parties/main/front";
  front.search = "";
  front.hash = "";

  return { frontUrl: front.toString(), reporterId, reporterToken };
}
