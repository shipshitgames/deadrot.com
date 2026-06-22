# Access waitlist (#355)

The Deadrot site captures access-waitlist signups **first-party**: the form posts
to `POST /api/waitlist/` on our own origin rather than to a third-party form
endpoint, so the form markup, validation, spam handling, and follow-up wiring all
live in this repo and are unit-/e2e-tested.

## How it works

```
components/site/waitlist.tsx   →  POST /api/waitlist/   →  lib/waitlist-sink.ts
        (form, honeypot)            (app/api/waitlist/route.ts)     (follow-up)
                                     uses lib/waitlist.ts
                                     (pure validation contract)
```

- **`lib/waitlist.ts`** — pure, framework-free validation shared by the route, the
  form, and the tests: email normalize/validate, source normalize (length-capped),
  honeypot check, and `parseWaitlistFields()`.
- **`app/api/waitlist/route.ts`** — the handler. Returns plain web `Response.json`
  (not `NextResponse`) so it unit-tests as a pure function. On a valid signup it
  stamps an ISO timestamp and calls `recordSignup`.
- **`lib/waitlist-sink.ts`** — the only side-effecting layer: forwards the signup
  to the configured destination, or structured-logs when none is set.

## Spam handling

A hidden `company` honeypot field (off-screen, `aria-hidden`, `tabIndex=-1`) is
never filled by a human. When it is filled the route returns `200 { ok: true }`
but records **nothing** — the bot is dropped silently and never told it was caught.
The email regex is anchored and class-based (no backtracking) so a long hostile
input can't ReDoS, and both email and source are length-capped before they reach
the log or forward payload.

## Where signups go (follow-up / export / admin)

The capture surface is fixed; the **destination is pluggable per environment** so
the repo never pins a single vendor. Resolution order (see `waitlistForwardTarget`):

| Env var | Destination |
| --- | --- |
| `WAITLIST_FORWARD_URL` | Any endpoint that accepts a JSON `POST { email, source, at }` — a webhook, a serverless function, a Google Apps Script writing to a Sheet, an ESP/CRM intake, etc. **Wins if both are set.** |
| `FORMSPREE_ID` / `NEXT_PUBLIC_FORMSPREE_ID` | Shorthand for a [Formspree](https://formspree.io) inbox, posted to `https://formspree.io/f/<id>`. Matches the inbox the older static form used. |
| _(neither set)_ | The route **structured-logs** `{ source, at }` at info level (never the raw address) and returns ok. The platform log drain is the record of last resort; ops can replay from it. Dev / CI / e2e use this path so they never depend on an external service. |

A forward outage never 500s a signup: `recordSignup` catches transport errors and
also checks `res.ok`, logging a non-ok HTTP reply (4xx/5xx) at error level rather
than letting it pass silently — so both a dropped connection and a rejected forward
leave a trace, and the structured log remains a recoverable fallback either way.

### Recommended production setup

1. Stand up a destination that persists signups somewhere queryable/exportable —
   the lowest-friction options are a Formspree inbox (CSV export + email
   notifications, zero infra) or a Google Apps Script web app appending rows to a
   Sheet (free, exportable, shareable with non-engineers).
2. Set `WAITLIST_FORWARD_URL` (or `FORMSPREE_ID`) in the web app's environment.
3. **Export / admin:** pull the list from whichever destination you chose
   (Formspree dashboard CSV, the backing Sheet, or your CRM). There is no
   in-repo admin UI by design — the signup is forwarded to a system that already
   owns list management, dedup, and unsubscribe.

### Privacy note

The raw email address is only ever sent to the configured destination. The
fallback structured log deliberately omits it (logs `source` + `at` only), so
turning the sink off does not leak addresses into log storage.

## Tests

- `tests/unit/waitlist.test.ts` — the pure validation contract.
- `tests/unit/waitlist-route.test.ts` — the handler: valid JSON + form-encoded
  capture, 400 on invalid, honeypot records nothing, malformed JSON is a 400.
- `e2e/waitlist.spec.ts` — desktop + mobile smoke: a visitor joins from the
  homepage and sees the confirmation; the access-state legend is visible.
