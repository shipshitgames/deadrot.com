import type { GameSlug, ResourceBag, Summary, WarEvent, WorldState } from "@shipshitgames/warline";
import { applyOperation, createInitialWorld, resetWorld, summarize, TICK_MS, tick } from "@shipshitgames/warline";
import type * as Party from "partykit/server";
import {
  ADMIN_LIMIT,
  ADMIN_WINDOW_MS,
  bearer,
  MAX_REPORT_BYTES,
  parseMutationMeta,
  parseReportBody,
  parseReporterRegistry,
  RECEIPT_TTL_MS,
  REPORT_LIMIT,
  REPORT_WINDOW_MS,
  reportFingerprint,
  safeTokenEqual,
  storageIdentity,
  type TrustedOperationResult,
} from "./trust";

// The `front` room is the authoritative persistent world. Browser WebSockets
// and GET are read-only. Mutations arrive only from authenticated server-side
// reporters (HTTP report) or an administrator (HTTP reset).

interface WarlineEnv {
  /** JSON: { "reporter-id": { "token": "...", "games": ["slug"] } } */
  WARLINE_REPORTERS?: string;
  WARLINE_ADMIN_TOKEN?: string;
}

interface ReceiptBody {
  ok: true;
  summary: Summary;
  credited?: Partial<ResourceBag>;
  event?: WarEvent;
  idempotent?: boolean;
}

interface Receipt {
  fingerprint: string;
  response: ReceiptBody;
  expiresAt: number;
}

interface RateWindow {
  startedAt: number;
  count: number;
}

type MutationResult =
  | { kind: "accepted"; state: WorldState; body: ReceiptBody }
  | { kind: "duplicate"; body: ReceiptBody }
  | { kind: "conflict" }
  | { kind: "limited"; retryAfterSeconds: number };

const STORAGE_KEY = "world";
const RECEIPT_PREFIX = "receipt:";
const RATE_PREFIX = "rate:";

const PUBLIC_READ_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(
  body: unknown,
  status = 200,
  options: { publicRead?: boolean; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(options.publicRead ? PUBLIC_READ_HEADERS : {}),
      ...options.headers,
    },
  });
}

function exactResetBody(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    Object.keys(body).length === 1 &&
    (body as { type?: unknown }).type === "reset"
  );
}

async function readJsonBody(
  req: Party.Request,
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_REPORT_BYTES) {
    return { ok: false, response: jsonResponse({ ok: false, error: "request too large" }, 413) };
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > MAX_REPORT_BYTES) {
    return { ok: false, response: jsonResponse({ ok: false, error: "request too large" }, 413) };
  }
  try {
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, response: jsonResponse({ ok: false, error: "invalid json" }, 400) };
  }
}

function nextRateWindow(current: RateWindow | undefined, now: number, windowMs: number): RateWindow {
  if (!current || now - current.startedAt >= windowMs) return { startedAt: now, count: 1 };
  return { startedAt: current.startedAt, count: current.count + 1 };
}

export default class Warline implements Party.Server {
  state: WorldState;

  constructor(readonly room: Party.Room) {
    this.state = createInitialWorld(Date.now());
  }

  private get env(): WarlineEnv {
    return this.room.env as WarlineEnv;
  }

  async onStart() {
    const stored = await this.room.storage.get<WorldState>(STORAGE_KEY);
    this.state = stored ?? createInitialWorld(Date.now());
    if (!stored) await this.room.storage.put(STORAGE_KEY, this.state);
    if ((await this.room.storage.getAlarm()) === null) {
      await this.room.storage.setAlarm(Date.now() + TICK_MS);
    }
  }

  private broadcast() {
    this.room.broadcast(JSON.stringify({ t: "state", state: this.state }));
  }

  async onAlarm() {
    const now = Date.now();
    this.state = await this.room.storage.transaction(async (txn) => {
      const current = (await txn.get<WorldState>(STORAGE_KEY)) ?? this.state;
      const next = tick(current, now);
      await txn.put(STORAGE_KEY, next);
      return next;
    });
    this.broadcast();

    // Receipts only need to outlive the accepted replay window. Bounded expiry
    // keeps idempotency durable without turning storage into an unbounded log.
    const receipts = await this.room.storage.list<Receipt>({ prefix: RECEIPT_PREFIX, limit: 1_000 });
    const expired = [...receipts.entries()].filter(([, receipt]) => receipt.expiresAt <= now).map(([key]) => key);
    if (expired.length) await this.room.storage.delete(expired);
    await this.room.storage.setAlarm(now + TICK_MS);
  }

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ t: "hello", state: this.state, authority: "read-only" }));
  }

  onMessage(raw: string | ArrayBuffer | ArrayBufferView, sender: Party.Connection) {
    if (typeof raw !== "string") return;
    let msg: { t?: unknown };
    try {
      msg = JSON.parse(raw) as { t?: unknown };
    } catch {
      return;
    }
    if (msg.t === "command" || msg.t === "sim" || msg.t === "reset") {
      sender.send(
        JSON.stringify({
          t: "cmdresult",
          ok: false,
          error: "authoritative front is read-only; use the isolated browser demo",
        }),
      );
    }
  }

  private async mutateReport(
    reporterId: string,
    subject: string,
    result: TrustedOperationResult,
    now: number,
  ): Promise<MutationResult> {
    const identity = `${storageIdentity(reporterId)}:${storageIdentity(subject)}`;
    const receiptKey = `${RECEIPT_PREFIX}${identity}:${result.nonce}`;
    const rateKey = `${RATE_PREFIX}report:${identity}`;
    const fingerprint = reportFingerprint(reporterId, subject, result);

    return this.room.storage.transaction(async (txn) => {
      const existing = await txn.get<Receipt>(receiptKey);
      if (existing && existing.expiresAt > now) {
        if (existing.fingerprint !== fingerprint) return { kind: "conflict" } as const;
        return { kind: "duplicate", body: { ...existing.response, idempotent: true } } as const;
      }
      if (existing) await txn.delete(receiptKey);

      const currentRate = await txn.get<RateWindow>(rateKey);
      if (currentRate && now - currentRate.startedAt < REPORT_WINDOW_MS && currentRate.count >= REPORT_LIMIT) {
        return {
          kind: "limited",
          retryAfterSeconds: Math.max(1, Math.ceil((currentRate.startedAt + REPORT_WINDOW_MS - now) / 1_000)),
        } as const;
      }

      const current = (await txn.get<WorldState>(STORAGE_KEY)) ?? this.state;
      const applied = applyOperation(current, result, now);
      const body: ReceiptBody = {
        ok: true,
        summary: summarize(applied.state),
        credited: applied.credited,
        event: applied.event,
      };
      await txn.put(STORAGE_KEY, applied.state);
      await txn.put(rateKey, nextRateWindow(currentRate, now, REPORT_WINDOW_MS));
      await txn.put(receiptKey, { fingerprint, response: body, expiresAt: now + RECEIPT_TTL_MS } satisfies Receipt);
      return { kind: "accepted", state: applied.state, body } as const;
    });
  }

  private async handleReport(req: Party.Request, body: unknown): Promise<Response> {
    const registry = parseReporterRegistry(this.env.WARLINE_REPORTERS);
    if (!registry) return jsonResponse({ ok: false, error: "reporting unavailable" }, 503);

    const reporterId = req.headers.get("x-warline-reporter") ?? "";
    const reporter = registry.get(reporterId);
    if (!reporter || !safeTokenEqual(bearer(req.headers), reporter.token)) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    }

    const now = Date.now();
    const meta = parseMutationMeta(req.headers, now);
    if (!meta.ok) return jsonResponse({ ok: false, error: meta.error }, meta.status);
    const parsed = parseReportBody(body, meta.value.requestId);
    if (!parsed.ok) return jsonResponse({ ok: false, error: parsed.error }, parsed.status);
    if (!reporter.games.includes(parsed.value.game as GameSlug)) {
      return jsonResponse({ ok: false, error: "reporter not authorized for game" }, 403);
    }

    const mutation = await this.mutateReport(reporterId, meta.value.subject, parsed.value, now);
    if (mutation.kind === "conflict") return jsonResponse({ ok: false, error: "nonce conflict" }, 409);
    if (mutation.kind === "limited") {
      return jsonResponse({ ok: false, error: "rate limit exceeded" }, 429, {
        headers: { "Retry-After": String(mutation.retryAfterSeconds) },
      });
    }
    if (mutation.kind === "accepted") {
      this.state = mutation.state;
      this.broadcast();
    }
    return jsonResponse(mutation.body);
  }

  private async mutateReset(subject: string, requestId: string, now: number): Promise<MutationResult> {
    const identity = storageIdentity(subject);
    const receiptKey = `${RECEIPT_PREFIX}admin:${identity}:${requestId}`;
    const rateKey = `${RATE_PREFIX}admin`;
    const fingerprint = JSON.stringify({ type: "reset", subject });

    return this.room.storage.transaction(async (txn) => {
      const existing = await txn.get<Receipt>(receiptKey);
      if (existing && existing.expiresAt > now) {
        if (existing.fingerprint !== fingerprint) return { kind: "conflict" } as const;
        return { kind: "duplicate", body: { ...existing.response, idempotent: true } } as const;
      }
      if (existing) await txn.delete(receiptKey);

      const currentRate = await txn.get<RateWindow>(rateKey);
      if (currentRate && now - currentRate.startedAt < ADMIN_WINDOW_MS && currentRate.count >= ADMIN_LIMIT) {
        return {
          kind: "limited",
          retryAfterSeconds: Math.max(1, Math.ceil((currentRate.startedAt + ADMIN_WINDOW_MS - now) / 1_000)),
        } as const;
      }

      const current = (await txn.get<WorldState>(STORAGE_KEY)) ?? this.state;
      const next = resetWorld(now, current.epoch);
      const body: ReceiptBody = { ok: true, summary: summarize(next) };
      await txn.put(STORAGE_KEY, next);
      await txn.put(rateKey, nextRateWindow(currentRate, now, ADMIN_WINDOW_MS));
      await txn.put(receiptKey, { fingerprint, response: body, expiresAt: now + RECEIPT_TTL_MS } satisfies Receipt);
      return { kind: "accepted", state: next, body } as const;
    });
  }

  private async handleReset(req: Party.Request, body: unknown): Promise<Response> {
    const admin = this.env.WARLINE_ADMIN_TOKEN;
    if (!admin || admin.length < 32) return jsonResponse({ ok: false, error: "reset unavailable" }, 503);
    if (!safeTokenEqual(bearer(req.headers), admin)) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    }
    if (!exactResetBody(body)) return jsonResponse({ ok: false, error: "invalid reset envelope" }, 400);

    const now = Date.now();
    const meta = parseMutationMeta(req.headers, now);
    if (!meta.ok) return jsonResponse({ ok: false, error: meta.error }, meta.status);
    const mutation = await this.mutateReset(meta.value.subject, meta.value.requestId, now);
    if (mutation.kind === "conflict") return jsonResponse({ ok: false, error: "nonce conflict" }, 409);
    if (mutation.kind === "limited") {
      return jsonResponse({ ok: false, error: "rate limit exceeded" }, 429, {
        headers: { "Retry-After": String(mutation.retryAfterSeconds) },
      });
    }
    if (mutation.kind === "accepted") {
      this.state = mutation.state;
      this.broadcast();
    }
    return jsonResponse(mutation.body);
  }

  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: PUBLIC_READ_HEADERS });
    }
    if (req.method === "GET") {
      return jsonResponse({ state: this.state, summary: summarize(this.state) }, 200, { publicRead: true });
    }
    if (req.method !== "POST") {
      return jsonResponse({ ok: false, error: "method not allowed" }, 405);
    }

    const parsed = await readJsonBody(req);
    if (!parsed.ok) return parsed.response;
    const type =
      typeof parsed.body === "object" && parsed.body !== null && !Array.isArray(parsed.body)
        ? (parsed.body as { type?: unknown }).type
        : undefined;
    if (type === "report") return this.handleReport(req, parsed.body);
    if (type === "reset") return this.handleReset(req, parsed.body);
    if (type === "command" || type === "sim") {
      return jsonResponse({ ok: false, error: "authoritative front is read-only" }, 403);
    }
    return jsonResponse({ ok: false, error: "unknown type" }, 400);
  }
}
