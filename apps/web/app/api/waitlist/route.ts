import { parseWaitlistFields, type WaitlistFields } from "@/lib/waitlist";
import { recordSignup, WaitlistPersistenceError } from "@/lib/waitlist-sink";

// First-party waitlist capture for the Deadrot access surface (#355). The hub
// posts here (same-origin) instead of a third-party form endpoint, so the
// capture, validation, and follow-up wiring all live in the repo. The actual
// address is committed to first-party persistence before success is returned
// (see lib/waitlist-sink.ts + docs/waitlist.md).
//
// Returns plain web Responses (not NextResponse) so the handler unit-tests as a
// pure function — no Next runtime required.

async function readFields(req: Request): Promise<WaitlistFields> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return { email: body.email, source: body.source, honeypot: body.company };
  }
  // Form-encoded / multipart fallback for non-JSON clients (curl, a server-to-server
  // POST, or a future no-JS form). The site form posts JSON; this keeps the public
  // endpoint usable without one.
  const form = await req.formData().catch(() => null);
  if (!form) return {};
  return { email: form.get("email"), source: form.get("source"), honeypot: form.get("company") };
}

export async function POST(req: Request): Promise<Response> {
  const parsed = parseWaitlistFields(await readFields(req));

  if (!parsed.ok) {
    return Response.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  // Honeypot tripped: report success, record nothing — don't tip off the bot.
  if (parsed.trap) {
    return Response.json({ ok: true });
  }

  try {
    await recordSignup({ ...parsed.signup, at: new Date().toISOString() });
  } catch (error) {
    if (!(error instanceof WaitlistPersistenceError)) throw error;
    return Response.json({ ok: false, error: "We couldn't save your signup. Please try again." }, { status: 503 });
  }
  return Response.json({ ok: true });
}
