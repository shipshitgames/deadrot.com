import { GAME_SLUGS, type GameSlug, MAX_CONTRIBUTION, type OperationResult } from "@shipshitgames/warline";

export const MAX_REPORT_BYTES = 16_384;
export const MAX_REPORT_SCORE = 1_000_000;
export const REPORT_WINDOW_MS = 60_000;
export const REPORT_LIMIT = 20;
export const ADMIN_WINDOW_MS = 60 * 60_000;
export const ADMIN_LIMIT = 3;
export const REQUEST_CLOCK_SKEW_MS = 5 * 60_000;
export const RECEIPT_TTL_MS = 10 * 60_000;

const REPORTER_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/;
const SUBJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._:@-]{2,127}$/;
const NONCE = /^[A-Za-z0-9][A-Za-z0-9:_-]{15,127}$/;
const RESULT_KEYS = new Set(["game", "faction", "outcome", "score", "nonce", "contributed"]);

export interface ReporterDefinition {
  token: string;
  games: readonly GameSlug[];
}

export interface MutationMeta {
  requestId: string;
  subject: string;
  timestamp: number;
}

export interface TrustedOperationResult extends OperationResult {
  nonce: string;
}

interface HeaderReader {
  get(name: string): string | null;
}

export type TrustResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

/** Parse the server-only reporter registry. Any malformed entry invalidates the registry. */
export function parseReporterRegistry(raw: string | undefined): Map<string, ReporterDefinition> | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || Object.keys(parsed).length === 0) return null;

  const registry = new Map<string, ReporterDefinition>();
  for (const [id, value] of Object.entries(parsed)) {
    if (!REPORTER_ID.test(id) || !isRecord(value)) return null;
    if (!hasExactKeys(value, new Set(["token", "games"]))) return null;
    if (typeof value.token !== "string" || value.token.length < 32 || value.token.length > 512) return null;
    if (!Array.isArray(value.games) || value.games.length === 0) return null;
    const games = value.games.filter(
      (game): game is GameSlug => typeof game === "string" && GAME_SLUGS.includes(game as GameSlug),
    );
    if (games.length !== value.games.length || new Set(games).size !== games.length) return null;
    registry.set(id, { token: value.token, games });
  }
  return registry;
}

/** Constant-work string comparison for server credentials without logging either value. */
export function safeTokenEqual(actual: string | undefined, expected: string): boolean {
  const candidate = actual ?? "";
  const length = Math.max(candidate.length, expected.length);
  let mismatch = candidate.length ^ expected.length;
  for (let i = 0; i < length; i++) {
    mismatch |= (candidate.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

export function bearer(headers: HeaderReader): string | undefined {
  const header = headers.get("authorization");
  const match = header ? /^Bearer\s+(.+)$/i.exec(header) : null;
  return match?.[1];
}

/** Validate identity and anti-replay headers supplied by the trusted server broker. */
export function parseMutationMeta(headers: HeaderReader, now: number): TrustResult<MutationMeta> {
  const requestId = headers.get("x-warline-request-id") ?? "";
  const subject = headers.get("x-warline-subject") ?? "";
  const timestampRaw = headers.get("x-warline-timestamp") ?? "";
  const timestamp = Number(timestampRaw);

  if (!NONCE.test(requestId)) return { ok: false, status: 400, error: "invalid request id" };
  if (!SUBJECT_ID.test(subject)) return { ok: false, status: 400, error: "invalid subject" };
  if (!/^\d{10,16}$/.test(timestampRaw) || !Number.isSafeInteger(timestamp)) {
    return { ok: false, status: 400, error: "invalid timestamp" };
  }
  if (Math.abs(now - timestamp) > REQUEST_CLOCK_SKEW_MS) {
    return { ok: false, status: 409, error: "request outside replay window" };
  }
  return { ok: true, value: { requestId, subject, timestamp } };
}

/** Strictly validate and rebuild the only operation shape the authoritative route accepts. */
export function parseReportBody(body: unknown, requestId: string): TrustResult<TrustedOperationResult> {
  if (!isRecord(body) || !hasExactKeys(body, new Set(["type", "result"])) || body.type !== "report") {
    return { ok: false, status: 400, error: "invalid report envelope" };
  }
  if (!isRecord(body.result) || !hasExactKeys(body.result, RESULT_KEYS)) {
    return { ok: false, status: 400, error: "invalid result fields" };
  }

  const result = body.result;
  if (typeof result.game !== "string" || !GAME_SLUGS.includes(result.game as GameSlug)) {
    return { ok: false, status: 400, error: "invalid game" };
  }
  if (result.faction !== "pyre" && result.faction !== "wardens") {
    return { ok: false, status: 400, error: "invalid faction" };
  }
  if (result.outcome !== "victory" && result.outcome !== "defeat") {
    return { ok: false, status: 400, error: "invalid outcome" };
  }
  if (
    typeof result.score !== "number" ||
    !Number.isFinite(result.score) ||
    result.score < 0 ||
    result.score > MAX_REPORT_SCORE
  ) {
    return { ok: false, status: 400, error: "invalid score" };
  }
  if (typeof result.nonce !== "string" || !NONCE.test(result.nonce) || result.nonce !== requestId) {
    return { ok: false, status: 400, error: "invalid nonce" };
  }
  if (
    result.contributed !== undefined &&
    (typeof result.contributed !== "number" ||
      !Number.isFinite(result.contributed) ||
      result.contributed < 0 ||
      result.contributed > MAX_CONTRIBUTION)
  ) {
    return { ok: false, status: 400, error: "invalid contribution" };
  }

  const trusted: TrustedOperationResult = {
    game: result.game as GameSlug,
    faction: result.faction,
    outcome: result.outcome,
    score: result.score,
    nonce: result.nonce,
  };
  if (result.contributed !== undefined) trusted.contributed = result.contributed;
  return { ok: true, value: trusted };
}

export function reportFingerprint(reporterId: string, subject: string, result: TrustedOperationResult): string {
  return JSON.stringify({ reporterId, subject, result });
}

export function storageIdentity(value: string): string {
  return encodeURIComponent(value);
}
