/**
 * @shipshitgames/warline/client — browser SDK (spec §8).
 *
 * The ONLY module allowed to import 'partysocket'. Never imported by the index
 * barrel, so the pure core stays dependency-free and server-safe.
 */

import { PartySocket } from "partysocket";
import type { OperationResult, ResourceBag, Summary, WorldState } from "./types";

export interface WarlineReporterIdentity {
  /** Server-configured reporter id present in WARLINE_REPORTERS. */
  id: string;
  /** Server-only credential. Never expose this through a VITE_* variable. */
  token: string;
  /** Identity established by the calling server (for example a Clerk user id). */
  subject: string;
}

export interface WarlineClientOptions {
  host: string;
  /** Omit for the public read-only client; required by reportOperation. */
  reporter?: WarlineReporterIdentity;
}

export interface ReportResponse {
  ok: boolean;
  summary?: Summary;
  credited?: Partial<ResourceBag>;
  idempotent?: boolean;
  error?: string;
}

/** Resolve the HTTP/WS base path for the singleton `front` room. */
export function warlineUrl(host: string): string {
  const isHttps = typeof location !== "undefined" && location.protocol === "https:";
  const secure = isHttps || /^(https|wss):\/\//.test(host);
  const bare = host.replace(/^(https?|wss?):\/\//, "");
  const proto = secure ? "https:" : "http:";
  return `${proto}//${bare}/parties/main/front`;
}

export class WarlineClient {
  private host: string;
  private reporter?: WarlineReporterIdentity;

  constructor(opts: WarlineClientOptions) {
    this.host = opts.host;
    this.reporter = opts.reporter;
  }

  /** GET the current world (server returns { state, summary }). */
  async fetchState(): Promise<WorldState> {
    const res = await fetch(warlineUrl(this.host), { method: "GET" });
    if (!res.ok) throw new Error(`warline fetchState failed: ${res.status}`);
    const data = (await res.json()) as { state: WorldState };
    return data.state;
  }

  /** POST a trusted game result from a server-side reporter. */
  async reportOperation(result: OperationResult): Promise<ReportResponse> {
    if (!this.reporter) return { ok: false, error: "server reporter identity required" };
    if (!result.nonce) return { ok: false, error: "operation nonce required" };
    const headers: Record<string, string> = {
      "content-type": "application/json",
      authorization: `Bearer ${this.reporter.token}`,
      "x-warline-reporter": this.reporter.id,
      "x-warline-subject": this.reporter.subject,
      "x-warline-request-id": result.nonce,
      "x-warline-timestamp": String(Date.now()),
    };
    const res = await fetch(warlineUrl(this.host), {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "report", result }),
    });
    const data = (await res.json().catch(() => ({}))) as ReportResponse;
    return { ...data, ok: res.ok && data.ok !== false };
  }
}

export interface WarlineSocket {
  close: () => void;
}

/**
 * Open a live WS to the `front` room and stream world state.
 * Parses { t:'hello'|'state', state } frames.
 */
export function connectWarline(
  host: string,
  handlers: {
    onState: (s: WorldState) => void;
    onStatus?: (connected: boolean) => void;
  },
): WarlineSocket {
  const socket = new PartySocket({
    host,
    party: "main",
    room: "front",
  });

  socket.addEventListener("open", () => {
    handlers.onStatus?.(true);
  });

  socket.addEventListener("close", () => {
    handlers.onStatus?.(false);
  });

  socket.addEventListener("message", (ev: MessageEvent) => {
    try {
      const raw = typeof ev.data === "string" ? ev.data : String(ev.data);
      const msg = JSON.parse(raw) as { t?: string; state?: WorldState };
      if ((msg.t === "hello" || msg.t === "state") && msg.state) {
        handlers.onState(msg.state);
      }
    } catch {
      // ignore malformed frames
    }
  });

  return {
    close: () => socket.close(),
  };
}
