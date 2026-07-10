# Access waitlist

Deadrot captures access-waitlist signups first-party. A browser posts to the web
route, and that route reports success only after the dedicated Deadrot API has
committed the normalized address to the existing Deadrot Postgres database.

```text
browser → POST deadrot.com/api/waitlist/ → POST api.deadrot.com/v1/waitlist
                                               │
                                               ├─ waitlist_signups (authoritative)
                                               └─ waitlist_outbox → optional sink
```

## Integrity and failure behavior

- The web route validates and normalizes the email, applies the honeypot, then
  authenticates server-to-server with `WAITLIST_API_TOKEN`.
- The API validates again and stores the address in `waitlist_signups` inside a
  transaction. Normalized email is unique, so retries and duplicate submissions
  return success without creating duplicate records or outbox jobs.
- The same transaction creates one `waitlist_outbox` row. If no downstream sink
  is configured, the durable database record remains authoritative and the job
  waits. When `WAITLIST_FORWARD_URL` is present, the long-running API worker
  attempts delivery in leased batches.
- Sink 4xx, 5xx, timeout, and network failures never roll back or delete the
  signup. The job is released with a sanitized reason and exponential retry
  delay (30 seconds up to 6 hours). Expired leases make a worker crash retryable.
  Delivery is at-least-once; every attempt carries the stable
  `Idempotency-Key: deadrot-waitlist-<signup id>` so compatible sinks can dedupe a
  success followed by a worker crash.
- Missing/invalid production or preview web config, an unavailable API, or an
  unavailable database returns `503`; the UI keeps the form and asks the visitor
  to retry. There is no log-only success path.
- The API deploy requires a non-empty `WAITLIST_INGEST_TOKEN` in the Deadrot SSM
  subtree before replacing the live container. Production readiness also fails
  closed when that token is missing.

## Environment

Web (Vercel):

```dotenv
WAITLIST_API_URL=https://api.deadrot.com/v1/waitlist
WAITLIST_API_TOKEN=<same secret as the API>
```

API (Deadrot SSM subtree rendered into the container):

```dotenv
WAITLIST_INGEST_TOKEN=<same secret as the web>
WAITLIST_FORWARD_URL=<optional HTTPS sink>
```

Local development can run both apps with a local database. UI-only E2E explicitly
sets `WAITLIST_LOCAL_FILE`; the web route appends JSONL, fsyncs it, and only then
returns success. Local-file mode is rejected under production or Vercel preview,
so it cannot become an accidental hosted persistence layer.

## Privacy, retention, export, and deletion

- Raw addresses exist only in the Postgres signup table, an explicitly configured
  local test file, and the optional forwarding payload. Application logs contain
  no email, bearer token, sink response body, or exception text. Outbox errors
  store only `http_<status>` or `network_error`.
- Access to the database and exports is limited to operators already authorized
  for the dedicated Deadrot RDS. Exports are operational artifacts: write them to
  an access-controlled encrypted location, do not commit them, and delete them
  after import/hand-off is verified.
- Retain active waitlist records while the access program is operating. Review
  quarterly; purge addresses no later than 90 days after the program closes or
  immediately on a verified deletion request. Never purge an undelivered outbox
  row independently of its signup. Keep delivered outbox rows for the signup's
  lifetime: their unique key prevents a later duplicate submission from being
  forwarded twice.

Run exports and retention actions with `psql` against the dedicated Deadrot DB:

```sql
-- CSV export (psql \copy creates the file on the operator machine)
\copy (SELECT email, source, captured_at, last_seen_at FROM waitlist_signups ORDER BY captured_at) TO 'waitlist.csv' WITH (FORMAT csv, HEADER true)

-- Verified deletion request (the outbox row cascades)
\set email 'verified-address@example.com'
DELETE FROM waitlist_signups WHERE email = lower(trim(:'email'));
```

Program-close retention is a deliberate operator action because the close date
is a product decision, not a timestamp the service can infer safely.

## Tests

- Web route/unit tests cover validation, unavailable persistence, hostile Stripe
  `Origin`, canonical redirect policy, and owner checkout no-op behavior.
- API route tests cover durable success, authentication, duplicate signup, and
  unavailable persistence.
- API outbox tests cover sink 4xx/5xx/network failure, privacy-safe errors, retry,
  recovery, and the no-sink pending state.
- Playwright desktop/mobile smoke uses explicit fsynced test persistence.
