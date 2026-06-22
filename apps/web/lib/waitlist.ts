// First-party Deadrot access-waitlist capture (issue #355).
//
// Pure, framework-free validation so the API route (app/api/waitlist/route.ts),
// the client form (components/site/waitlist.tsx), and the unit tests all share
// ONE contract. Nothing here touches the network or env — side effects live in
// lib/waitlist-sink.ts so this module stays trivially testable.

export const WAITLIST_SOURCE_DEFAULT = "site";
// RFC 5321 caps an address at 254 chars; cap source so a hostile client can't
// stuff the structured log / forward payload.
export const MAX_EMAIL_LENGTH = 254;
export const MAX_SOURCE_LENGTH = 64;

export interface WaitlistSignup {
  email: string;
  source: string;
  /** ISO-8601 capture timestamp, stamped by the route (kept out of the pure layer). */
  at: string;
}

// Deliberately conservative single-line check: exactly one `@`, non-empty local
// and domain parts, a dot in the domain, and no whitespace. Not RFC-perfect on
// purpose — just enough to reject junk before it reaches the follow-up sink.
// Anchored + class-based (no backtracking) so it can't ReDoS on a long input.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export function isValidEmail(email: string): boolean {
  return email.length > 0 && email.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(email);
}

export function normalizeSource(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  return value ? value.slice(0, MAX_SOURCE_LENGTH) : WAITLIST_SOURCE_DEFAULT;
}

// Hidden honeypot input: a real visitor never fills it; bots that auto-fill
// every field do. A tripped honeypot is treated as a (silent) success upstream
// so we never tell the bot it was caught.
export function isHoneypotTripped(raw: unknown): boolean {
  return typeof raw === "string" && raw.trim().length > 0;
}

export interface WaitlistFields {
  email?: unknown;
  source?: unknown;
  /** Honeypot field value (see isHoneypotTripped). */
  honeypot?: unknown;
}

export type WaitlistParseResult =
  | { ok: true; trap: boolean; signup: Omit<WaitlistSignup, "at"> }
  | { ok: false; error: string };

export function parseWaitlistFields(fields: WaitlistFields): WaitlistParseResult {
  const source = normalizeSource(fields.source);
  // Honeypot first: drop bots before we even validate, but report success.
  if (isHoneypotTripped(fields.honeypot)) {
    return { ok: true, trap: true, signup: { email: "", source } };
  }
  const email = normalizeEmail(fields.email);
  if (!isValidEmail(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  return { ok: true, trap: false, signup: { email, source } };
}
