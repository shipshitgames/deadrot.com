import type { WaitlistSignup } from "@/lib/waitlist";

// Where a confirmed waitlist signup goes for follow-up. The capture surface stays
// first-party (deadrot.com/api/waitlist) while the actual destination is pluggable
// per-env, so the repo owns the form, validation, and wiring without pinning a
// single vendor:
//
//   - WAITLIST_FORWARD_URL  — any endpoint that accepts a JSON POST (webhook,
//                             serverless function, Google Apps Script, …).
//   - FORMSPREE_ID / NEXT_PUBLIC_FORMSPREE_ID — convenience shorthand for the
//                             Formspree inbox the static form used historically.
//
// Unset (CI / local dev / e2e) => we just structured-log and return. The request
// still succeeds, so the UX and the smoke tests never depend on an external
// service being reachable. The admin/export path is documented in docs/waitlist.md.

/** Resolved follow-up destination, or null when none is configured. Reads env at
 *  call time (not import time) so it tracks the live config and stays unit-testable. */
function waitlistForwardTarget(): string | null {
  const forwardUrl = process.env.WAITLIST_FORWARD_URL?.trim();
  if (forwardUrl) return forwardUrl;
  const formspreeId = (process.env.FORMSPREE_ID ?? process.env.NEXT_PUBLIC_FORMSPREE_ID)?.trim();
  if (formspreeId) return `https://formspree.io/f/${formspreeId}`;
  return null;
}

export async function recordSignup(signup: WaitlistSignup): Promise<void> {
  const target = waitlistForwardTarget();
  if (!target) {
    // No sink wired: the structured log IS the record (ops can replay from logs
    // / the platform's log drain). Never log the raw address at info level.
    console.info("[waitlist] signup", { source: signup.source, at: signup.at });
    return;
  }
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: signup.email, source: signup.source, at: signup.at }),
    });
    if (!res.ok) {
      // fetch only rejects on transport failure, not on a 4xx/5xx reply. Surface
      // the non-ok status so a forward that returns (e.g.) 500 isn't silently lost.
      console.error("[waitlist] forward returned non-ok", {
        status: res.status,
        source: signup.source,
        at: signup.at,
      });
    }
  } catch (error) {
    // A forward outage must never 500 the signup. Swallow + log; the structured
    // record above is the fallback so a dropped forward is recoverable.
    console.error("[waitlist] forward failed", error);
  }
}
